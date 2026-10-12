package service

import (
	"errors"
	"log"
	"strings"
	"unicode"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// PayoutTransfer is one transfer out of TBK's merchant account: a seller's
// share of a sale, or a refund to a buyer.
type PayoutTransfer struct {
	Reference string // ours, unique per transfer
	Provider  string // MPESA, AIRTEL_MONEY, ORANGE_MONEY, AFRIMONEY
	Phone     string // 243XXXXXXXXX
	Amount    float64
	Currency  string
	Purpose   string // SELLER_PAYOUT or BUYER_REFUND
}

// PayoutDriver sends money from TBK's merchant account to a phone. Like the
// charge driver, returning without error means "the operator accepted the
// transfer", never "the money arrived": that is confirmed by the operator's
// callback.
type PayoutDriver interface {
	// Send returns the operator's reference and whether the transfer was
	// actually handed to an operator.
	Send(transfer PayoutTransfer) (reference string, sent bool, err error)
}

// PendingPayoutDriver is used until the Moko merchant account is configured.
// It sends nothing: every payout and refund is recorded as PENDING, ready to go
// out the moment a live driver replaces it.
type PendingPayoutDriver struct{}

func (PendingPayoutDriver) Send(PayoutTransfer) (string, bool, error) { return "", false, nil }

const payoutNotConfigured = "Opérateur de versement non configuré (Moko)"

// logIf records a failed payout bookkeeping write instead of dropping it.
func (s *PayoutService) logIf(err error) {
	if err != nil {
		log.Printf("payout: %v", err)
	}
}

// PayoutService splits each settled mobile money payment: TBK keeps its
// commission and the delivery fee (and pays the operator's fee), and the
// seller's share goes straight to the seller's number on the same network the
// buyer paid with.
type PayoutService struct {
	repo           *repository.PayoutRepository
	paymentRepo    *repository.BuyerPaymentRepository
	commRepo       *repository.CommissionRepository
	membershipRepo *repository.MembershipRepository
	driver         PayoutDriver
}

func NewPayoutService(repo *repository.PayoutRepository, paymentRepo *repository.BuyerPaymentRepository, commRepo *repository.CommissionRepository, membershipRepo *repository.MembershipRepository) *PayoutService {
	return &PayoutService{repo: repo, paymentRepo: paymentRepo, commRepo: commRepo, membershipRepo: membershipRepo, driver: PendingPayoutDriver{}}
}

// SetDriver swaps in the live operator once its credentials are configured.
func (s *PayoutService) SetDriver(d PayoutDriver) {
	if d != nil {
		s.driver = d
	}
}

/* ── Payout numbers ───────────────────────────────────────── */

// NormalizeCongoPhone turns 0812345678, +243 812 345 678 or 812345678 into
// 243812345678, the form the operators expect. It returns "" when the number is
// not a valid DRC mobile number.
func NormalizeCongoPhone(raw string) string {
	var digits strings.Builder
	for _, r := range raw {
		if unicode.IsDigit(r) {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	switch {
	case strings.HasPrefix(d, "243") && len(d) == 12:
	case strings.HasPrefix(d, "0") && len(d) == 10:
		d = "243" + d[1:]
	case len(d) == 9:
		d = "243" + d
	default:
		return ""
	}
	if d[3] == '0' {
		return ""
	}
	return d
}

func (s *PayoutService) requireMember(userID, businessID uuid.UUID, manage bool) error {
	m, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || m == nil {
		return errors.New("FORBIDDEN")
	}
	if manage && m.Role != models.MembershipRoleOwner && m.Role != models.MembershipRoleAdmin {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *PayoutService) ListAccounts(userID, businessID uuid.UUID) ([]models.SellerPayoutAccount, error) {
	if err := s.requireMember(userID, businessID, false); err != nil {
		return nil, err
	}
	accounts, err := s.repo.ListAccounts(businessID)
	if accounts == nil {
		accounts = []models.SellerPayoutAccount{}
	}
	return accounts, err
}

// SaveAccounts stores the business's number on each of the four networks. All
// four are required: a payout always goes out on the network the buyer used.
// Payouts that were waiting for a number are sent right away.
func (s *PayoutService) SaveAccounts(userID, businessID uuid.UUID, req *models.SavePayoutAccountsRequest) ([]models.SellerPayoutAccount, error) {
	if err := s.requireMember(userID, businessID, true); err != nil {
		return nil, err
	}
	normalized := make(map[string]string, len(models.PayoutProviders))
	for _, provider := range models.PayoutProviders {
		phone := NormalizeCongoPhone(req.Accounts[provider])
		if phone == "" {
			return nil, errors.New("INVALID_PAYOUT_PHONE:" + provider)
		}
		normalized[provider] = phone
	}
	for provider, phone := range normalized {
		if err := s.repo.UpsertAccount(businessID, provider, phone, userID); err != nil {
			return nil, err
		}
	}
	s.retryBlocked(businessID)
	return s.repo.ListAccounts(businessID)
}

func (s *PayoutService) ListPayouts(userID, businessID uuid.UUID, limit int) ([]models.SellerPayout, error) {
	if err := s.requireMember(userID, businessID, false); err != nil {
		return nil, err
	}
	payouts, err := s.repo.ListPayouts(businessID, limit)
	if payouts == nil {
		payouts = []models.SellerPayout{}
	}
	return payouts, err
}

/* ── Splitting a settled payment ──────────────────────────── */

// OnPaymentSettled pays the seller's share of an order whose mobile money
// payment the operator has just confirmed. It runs after the commission
// snapshot is written, and is idempotent: a replayed webhook finds the existing
// payout and does nothing.
func (s *PayoutService) OnPaymentSettled(orderID uuid.UUID) {
	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil || payment == nil || !models.IsMobileMethod(payment.PaymentMethod) || payment.Provider == "" {
		return
	}
	comm, err := s.commRepo.GetByOrderID(orderID)
	if err != nil || comm == nil {
		log.Printf("payout: order %s settled without a commission snapshot", orderID)
		return
	}
	net := models.RoundMoney(comm.SellerNetAmount)
	currency := comm.Currency

	// A refunded order paid out earlier is owed back: it comes off this payout.
	owed, _ := s.repo.OpenClawbackTotal(comm.BusinessID, currency)
	deducted := owed
	if deducted > net {
		deducted = net
	}
	amount := models.RoundMoney(net - deducted)

	status := models.PayoutStatusPending
	phone := ""
	account, _ := s.repo.GetAccount(comm.BusinessID, payment.Provider)
	if account == nil {
		status = models.PayoutStatusBlocked
	} else {
		phone = account.Phone
	}
	if amount == 0 && account != nil {
		status = models.PayoutStatusPaid
	}

	paymentID := payment.ID
	payout, err := s.repo.CreatePayout(&models.SellerPayout{
		Kind: models.PayoutKindPayout, OrderID: orderID, BusinessID: comm.BusinessID, PaymentID: &paymentID,
		Provider: payment.Provider, Phone: phone, GrossAmount: net, DeductedAmount: deducted,
		Amount: amount, Currency: currency, Status: status,
	})
	if err != nil || payout == nil {
		return
	}

	// TBK kept its commission at the source, so the seller no longer owes it.
	_ = s.repo.MarkCommissionCollectedAtSource(orderID)

	if deducted > 0 {
		_ = s.repo.ApplyClawbacks(comm.BusinessID, currency)
		if rest := models.RoundMoney(owed - deducted); rest > 0 {
			// Not all of the debt fitted in this payout: carry the rest forward.
			_, _ = s.repo.CreatePayout(&models.SellerPayout{
				Kind: models.PayoutKindClawback, OrderID: orderID, BusinessID: comm.BusinessID,
				Provider: payment.Provider, GrossAmount: rest, Amount: rest, Currency: currency,
				Status: models.PayoutStatusPending,
			})
		}
	}

	if payout.Status == models.PayoutStatusPending {
		s.send(payout)
	}
}

func (s *PayoutService) send(p *models.SellerPayout) {
	reference, sent, err := s.driver.Send(PayoutTransfer{
		Reference: "PO-" + p.ID.String(), Provider: p.Provider, Phone: p.Phone,
		Amount: p.Amount, Currency: p.Currency, Purpose: "SELLER_PAYOUT",
	})
	switch {
	case err != nil:
		s.logIf(s.repo.UpdatePayoutStatus(p.ID, models.PayoutStatusFailed, "", "", err.Error(), true))
	case sent:
		s.logIf(s.repo.UpdatePayoutStatus(p.ID, models.PayoutStatusSent, "", reference, "", true))
	default:
		s.logIf(s.repo.UpdatePayoutStatus(p.ID, models.PayoutStatusPending, "", "", payoutNotConfigured, false))
	}
}

// retryBlocked sends the payouts that were waiting for a payout number.
func (s *PayoutService) retryBlocked(businessID uuid.UUID) {
	blocked, err := s.repo.ListBlocked(businessID)
	if err != nil {
		return
	}
	for i := range blocked {
		p := blocked[i]
		account, _ := s.repo.GetAccount(businessID, p.Provider)
		if account == nil {
			continue
		}
		p.Phone = account.Phone
		s.logIf(s.repo.UpdatePayoutStatus(p.ID, models.PayoutStatusPending, account.Phone, "", "", false))
		if p.Amount > 0 {
			s.send(&p)
		} else {
			s.logIf(s.repo.UpdatePayoutStatus(p.ID, models.PayoutStatusPaid, "", "", "", false))
		}
	}
}

/* ── Refunds ──────────────────────────────────────────────── */

// OnOrderRefunded returns the buyer's money from TBK's account and settles the
// seller's side: an unsent payout is cancelled, a payout already made is owed
// back from the seller's next payouts.
func (s *PayoutService) OnOrderRefunded(orderID uuid.UUID) {
	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil || payment == nil || !models.IsMobileMethod(payment.PaymentMethod) || payment.Provider == "" {
		return
	}

	if payout, _ := s.repo.GetPayoutByOrder(orderID, models.PayoutKindPayout); payout != nil {
		switch payout.Status {
		case models.PayoutStatusPending, models.PayoutStatusBlocked, models.PayoutStatusFailed:
			s.logIf(s.repo.UpdatePayoutStatus(payout.ID, models.PayoutStatusCancelled, "", "", "Commande remboursée", false))
		case models.PayoutStatusSent, models.PayoutStatusPaid:
			_, _ = s.repo.CreatePayout(&models.SellerPayout{
				Kind: models.PayoutKindClawback, OrderID: orderID, BusinessID: payout.BusinessID,
				Provider: payout.Provider, GrossAmount: payout.GrossAmount, Amount: payout.GrossAmount,
				Currency: payout.Currency, Status: models.PayoutStatusPending,
			})
		}
	}

	phone := NormalizeCongoPhone(payment.PayerPhone)
	paymentID := payment.ID
	refund, err := s.repo.CreateRefund(&models.BuyerRefund{
		OrderID: orderID, PaymentID: &paymentID, Provider: payment.Provider, Phone: phone,
		Amount: models.RoundMoney(payment.ProductsFinalTotal), Currency: payment.Currency,
		Status: models.PayoutStatusPending,
	})
	if err != nil || refund == nil {
		return
	}
	reference, sent, err := s.driver.Send(PayoutTransfer{
		Reference: "RF-" + refund.ID.String(), Provider: refund.Provider, Phone: refund.Phone,
		Amount: refund.Amount, Currency: refund.Currency, Purpose: "BUYER_REFUND",
	})
	switch {
	case err != nil:
		s.logIf(s.repo.UpdateRefundStatus(refund.ID, models.PayoutStatusFailed, "", err.Error()))
	case sent:
		s.logIf(s.repo.UpdateRefundStatus(refund.ID, models.PayoutStatusSent, reference, ""))
	default:
		s.logIf(s.repo.UpdateRefundStatus(refund.ID, models.PayoutStatusPending, "", payoutNotConfigured))
	}
}
