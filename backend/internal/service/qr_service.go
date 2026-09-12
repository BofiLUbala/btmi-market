package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrQRForbidden          = errors.New("QR_FORBIDDEN")
	ErrQRInvalid            = errors.New("QR_INVALID")
	ErrQRNotOperational     = errors.New("QR_NOT_OPERATIONAL")
	ErrQRWrongCourier       = errors.New("QR_WRONG_COURIER")
	ErrQRDuplicate          = errors.New("QR_DUPLICATE")
	ErrQRAlreadyCompleted   = errors.New("QR_ALREADY_COMPLETED")
	ErrQRDeliveryNotScanned = errors.New("DELIVERY_NOT_SCANNED")
	// ErrQRNotReady is returned before the seller has marked the order ready, i.e. before a
	// package QR exists. It keeps raw database errors out of API responses.
	ErrQRNotReady = errors.New("QR_NOT_READY")
)

type QRService struct {
	db             *database.DB
	membershipRepo *repository.MembershipRepository
	assignmentRepo *repository.AssignmentRepository
	employeeRepo   *repository.EmployeeRepository
	commSvc        *CommunicationService
	orderSvc       *OrderService
	secret         []byte
}

// SetOrderService wires the order state machine in after construction; OrderService and
// QRService reference each other, so neither can take the other in its constructor.
func (s *QRService) SetOrderService(o *OrderService) { s.orderSvc = o }

// IsCourier reports whether the user is a courier at all, i.e. has ever been assigned a
// delivery. Couriers have no dedicated role in the user model, so assignment is the only
// courier identity available; it is what keeps buyers and sellers off the scan endpoints.
func (s *QRService) IsCourier(userID uuid.UUID) bool {
	var exists bool
	if err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM orders WHERE assigned_courier_id=$1)`, userID).Scan(&exists); err != nil {
		return false
	}
	return exists
}

func NewQRService(db *database.DB, memberships *repository.MembershipRepository, assignments *repository.AssignmentRepository, employees *repository.EmployeeRepository, comm *CommunicationService) *QRService {
	secret := strings.TrimSpace(os.Getenv("QR_SIGNING_SECRET"))
	if secret == "" {
		secret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if secret == "" {
		secret = "tbk-local-qr-secret-change-in-production"
	}
	return &QRService{db: db, membershipRepo: memberships, assignmentRepo: assignments, employeeRepo: employees, commSvc: comm, secret: []byte(secret)}
}

func (s *QRService) token(kind, ref string) string {
	payload := "tbk." + kind + "." + ref
	h := hmac.New(sha256.New, s.secret)
	_, _ = h.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func (s *QRService) parse(token, kind string) (uuid.UUID, error) {
	p := strings.Split(token, ".")
	if len(p) != 4 || p[0] != "tbk" || p[1] != kind {
		return uuid.Nil, ErrQRInvalid
	}
	expected := s.token(kind, p[2])
	if !hmac.Equal([]byte(expected), []byte(token)) {
		return uuid.Nil, ErrQRInvalid
	}
	id, err := uuid.Parse(p[2])
	if err != nil {
		return uuid.Nil, ErrQRInvalid
	}
	return id, nil
}

func (s *QRService) sellerProductAccess(userID, productID uuid.UUID) error {
	var businessID uuid.UUID
	if err := s.db.QueryRow("SELECT business_id FROM products WHERE id=$1", productID).Scan(&businessID); err != nil {
		return err
	}
	m, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || m == nil {
		return ErrQRForbidden
	}
	return nil
}

func (s *QRService) ProductQR(userID, productID uuid.UUID) (*models.QRIdentity, error) {
	if err := s.sellerProductAccess(userID, productID); err != nil {
		return nil, err
	}
	var ref uuid.UUID
	var status string
	var created time.Time
	err := s.db.QueryRow(`INSERT INTO product_qr_codes(product_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING public_reference,status,created_at`, productID).Scan(&ref, &status, &created)
	if errors.Is(err, sql.ErrNoRows) {
		err = s.db.QueryRow(`SELECT public_reference,status,created_at FROM product_qr_codes WHERE product_id=$1 AND variant_id IS NULL`, productID).Scan(&ref, &status, &created)
	}
	if err != nil {
		return nil, err
	}
	return &models.QRIdentity{Reference: "PRD-" + strings.ToUpper(ref.String()[:8]), Token: s.token("p", ref.String()), Status: status, CreatedAt: created}, nil
}

func (s *QRService) EnsurePackage(orderID uuid.UUID) error {
	_, err := s.db.Exec(`INSERT INTO delivery_packages(order_id,shop_id,buyer_profile_id,operational)
	SELECT id,shop_id,buyer_profile_id,status IN ('READY','READY_FOR_PICKUP') FROM orders WHERE id=$1
	ON CONFLICT(order_id,package_number) DO UPDATE SET operational=delivery_packages.operational OR EXCLUDED.operational,updated_at=NOW()`, orderID)
	return err
}

func (s *QRService) packageForOrder(orderID uuid.UUID, includeToken bool) (*models.DeliveryPackageQR, error) {
	var p models.DeliveryPackageQR
	var ref uuid.UUID
	err := s.db.QueryRow(`SELECT id,order_id,package_number,public_reference,qr_status,operational,pickup_verified_at,delivery_scanned_at,receipt_confirmed_at FROM delivery_packages WHERE order_id=$1 AND qr_status='ACTIVE' ORDER BY package_number LIMIT 1`, orderID).Scan(&p.ID, &p.OrderID, &p.PackageNumber, &ref, &p.Status, &p.Operational, &p.PickupVerifiedAt, &p.DeliveryScannedAt, &p.ReceiptConfirmedAt)
	if err != nil {
		return nil, err
	}
	p.Reference = "PKG-" + strings.ToUpper(ref.String()[:8])
	if includeToken {
		p.Token = s.token("d", ref.String())
	}
	return &p, nil
}

func (s *QRService) SellerPackageQR(userID, orderID uuid.UUID) (*models.DeliveryPackageQR, error) {
	var businessID uuid.UUID
	if err := s.db.QueryRow("SELECT business_id FROM orders WHERE id=$1", orderID).Scan(&businessID); err != nil {
		return nil, err
	}
	m, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || m == nil {
		return nil, ErrQRForbidden
	}
	if err = s.EnsurePackage(orderID); err != nil {
		return nil, err
	}
	pkg, err := s.packageForOrder(orderID, true)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrQRNotReady
	}
	return pkg, err
}

func (s *QRService) BuyerPackageQR(userID, orderID uuid.UUID) (*models.DeliveryPackageQR, error) {
	var owner uuid.UUID
	err := s.db.QueryRow(`SELECT bp.user_id FROM orders o JOIN buyer_profiles bp ON bp.id=o.buyer_profile_id WHERE o.id=$1`, orderID).Scan(&owner)
	if err != nil || owner != userID {
		return nil, ErrQRForbidden
	}
	// The buyer never creates or regenerates the QR; they only read the one the seller's
	// "ready for pickup" produced. Before that exists, say so plainly.
	pkg, err := s.packageForOrder(orderID, true)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrQRNotReady
	}
	return pkg, err
}

func (s *QRService) recordScan(tx *sql.Tx, pkgID, orderID uuid.UUID, courierID *uuid.UUID, typ, result, reason string, req models.QRScanRequest) {
	meta, _ := json.Marshal(req.DeviceMetadata)
	key := req.IdempotencyKey
	if len(key) > 100 {
		sum := sha256.Sum256([]byte(key))
		key = "sha256:" + fmt.Sprintf("%x", sum[:])
	}
	_, _ = tx.Exec(`INSERT INTO delivery_scan_events(id,idempotency_key,delivery_id,package_id,order_id,courier_id,scan_type,scan_result,reason,latitude,longitude,device_id,device_metadata,status_before,status_after) VALUES($1,NULLIF($2,''),$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`, uuid.New(), key, pkgID, orderID, courierID, typ, result, reason, req.Latitude, req.Longitude, req.DeviceID, meta, currentDeliveryStatusFromMetadata(req), resultStatusFromMetadata(req))
}

func currentDeliveryStatusFromMetadata(req models.QRScanRequest) string {
	if v, ok := req.DeviceMetadata["status_before"].(string); ok {
		return v
	}
	return ""
}
func resultStatusFromMetadata(req models.QRScanRequest) string {
	if v, ok := req.DeviceMetadata["status_after"].(string); ok {
		return v
	}
	return ""
}

func (s *QRService) Scan(courierID uuid.UUID, typ string, req models.QRScanRequest) (*models.QRScanResponse, error) {
	ref, err := s.parse(req.Token, "d")
	if err != nil {
		return nil, err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var pkgID, orderID uuid.UUID
	var qrStatus, orderStatus, currentDeliveryStatus string
	var operational bool
	var assigned *uuid.UUID
	var pickup, delivery, receipt *time.Time
	err = tx.QueryRow(`SELECT p.id,p.order_id,p.qr_status,p.operational,o.assigned_courier_id,p.pickup_verified_at,p.delivery_scanned_at,p.receipt_confirmed_at,o.status::text,COALESCE(o.delivery_status,'')
	FROM delivery_packages p JOIN orders o ON o.id=p.order_id WHERE p.public_reference=$1 FOR UPDATE`, ref).Scan(
		&pkgID, &orderID, &qrStatus, &operational, &assigned, &pickup, &delivery, &receipt, &orderStatus, &currentDeliveryStatus)
	if err != nil {
		return nil, ErrQRInvalid
	}

	// reject records the failed scan, commits it so the attempt survives, and returns err.
	// Every rejection path is persisted: a failed scan is exactly what audit needs to see.
	reject := func(result, reason string, out error) (*models.QRScanResponse, error) {
		if req.DeviceMetadata == nil {
			req.DeviceMetadata = map[string]interface{}{}
		}
		req.DeviceMetadata["status_before"] = currentDeliveryStatus
		req.DeviceMetadata["status_after"] = currentDeliveryStatus
		s.recordScan(tx, pkgID, orderID, &courierID, typ, result, reason, req)
		_ = tx.Commit()
		return nil, out
	}

	if req.OrderID != nil && *req.OrderID != orderID {
		return reject("REJECTED", "WRONG_ORDER", ErrQRInvalid)
	}
	if qrStatus != "ACTIVE" {
		return reject("REJECTED", "QR_"+qrStatus, ErrQRInvalid)
	}
	if !operational {
		return reject("REJECTED", "NOT_OPERATIONAL", ErrQRNotOperational)
	}
	if assigned == nil || *assigned != courierID {
		return reject("REJECTED", "WRONG_COURIER", ErrQRWrongCourier)
	}
	var courierActive bool
	if err = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM couriers WHERE user_id=$1 AND status='ACTIVE')`, courierID).Scan(&courierActive); err != nil || !courierActive {
		return reject("REJECTED", "COURIER_NOT_ACTIVE", ErrQRForbidden)
	}
	if receipt != nil {
		return reject("DUPLICATE", "ALREADY_COMPLETED", ErrQRAlreadyCompleted)
	}

	var column string
	var target models.OrderStatus
	var deliveryStatus, resultStatus string
	requiresBuyerConfirmation := false
	if req.DeviceMetadata == nil {
		req.DeviceMetadata = map[string]interface{}{}
	}
	req.DeviceMetadata["status_before"] = currentDeliveryStatus

	switch typ {
	case "PICKUP":
		if pickup != nil {
			// Idempotent: a re-scan reports the existing pickup instead of creating a second one.
			s.recordScan(tx, pkgID, orderID, &courierID, typ, "DUPLICATE", "PICKUP_ALREADY_VERIFIED", req)
			if err = tx.Commit(); err != nil {
				return nil, err
			}
			return &models.QRScanResponse{Result: "DUPLICATE", OrderID: orderID, PackageID: pkgID, DeliveryStatus: "PICKED_UP"}, nil
		}
		if orderStatus != string(models.OrderStatusReady) || (currentDeliveryStatus != "COURIER_ACCEPTED" && currentDeliveryStatus != "READY_FOR_PICKUP") {
			return reject("REJECTED", "INVALID_ORDER_STATE", ErrQRNotOperational)
		}
		column, target, deliveryStatus, resultStatus = "pickup_verified_at", models.OrderStatusOutForDelivery, "PICKED_UP", "PICKED_UP"
	case "DELIVERY":
		if pickup == nil {
			return reject("REJECTED", "PICKUP_NOT_VERIFIED", ErrQRNotOperational)
		}
		if delivery != nil {
			s.recordScan(tx, pkgID, orderID, &courierID, typ, "DUPLICATE", "DELIVERY_ALREADY_SCANNED", req)
			if err = tx.Commit(); err != nil {
				return nil, err
			}
			return &models.QRScanResponse{Result: "DUPLICATE", OrderID: orderID, PackageID: pkgID, DeliveryStatus: "AWAITING_BUYER_CONFIRMATION", RequiresBuyerConfirmation: true}, nil
		}
		if currentDeliveryStatus != "IN_TRANSIT" && currentDeliveryStatus != "COURIER_ARRIVED" {
			return reject("REJECTED", "INVALID_ORDER_STATE", ErrQRNotOperational)
		}
		column, target, deliveryStatus, resultStatus = "delivery_scanned_at", models.OrderStatusDelivered, "DELIVERY_SCAN_SUCCESS", "AWAITING_BUYER_CONFIRMATION"
		requiresBuyerConfirmation = true
	default:
		return reject("INVALID", "UNKNOWN_SCAN_TYPE", ErrQRInvalid)
	}

	// The order state machine is authoritative. A scan that the order's own status does not
	// allow is rejected here rather than silently forcing the order into an invalid state.
	if s.orderSvc != nil {
		if err = applyTransitionTx(tx, orderID, courierID, target, "Courier QR scan ("+typ+")", "COURIER"); err != nil {
			return reject("REJECTED", "INVALID_ORDER_STATE", ErrQRNotOperational)
		}
	}

	if _, err = tx.Exec(fmt.Sprintf("UPDATE delivery_packages SET %s=NOW(),updated_at=NOW() WHERE id=$1", column), pkgID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(`UPDATE orders SET delivery_status=$2,updated_at=NOW() WHERE id=$1`, orderID, deliveryStatus); err != nil {
		return nil, err
	}
	req.DeviceMetadata["status_after"] = deliveryStatus
	s.recordScan(tx, pkgID, orderID, &courierID, typ, "SUCCESS", "", req)
	if err = tx.Commit(); err != nil {
		return nil, err
	}

	if s.commSvc != nil {
		event := models.NotificationTypeCourierPickedUp
		if typ == "DELIVERY" {
			event = models.NotificationTypeOrderDelivered
		}
		_ = s.commSvc.TriggerOrderEventNotification(orderID, event, map[string]interface{}{
			"package_id": pkgID.String(), "scan_type": typ, "courier_user_id": courierID.String(),
		})
		if typ == "DELIVERY" {
			_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeBuyerReceiptRequired, map[string]interface{}{"package_id": pkgID.String()})
		}
	}
	return &models.QRScanResponse{Result: "SUCCESS", OrderID: orderID, PackageID: pkgID, DeliveryStatus: resultStatus, RequiresBuyerConfirmation: requiresBuyerConfirmation}, nil
}

// ConfirmReceipt records the buyer's confirmation that the goods physically arrived.
// It deliberately does NOT confirm payment: cash verification stays a separate track, and
// the order only reaches COMPLETED through CompleteIfReceivedAndPaid, which requires both.
func (s *QRService) ConfirmReceipt(userID, orderID uuid.UUID) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var owner, pkg uuid.UUID
	var scanned, confirmed *time.Time
	err = tx.QueryRow(`SELECT bp.user_id,p.id,p.delivery_scanned_at,p.receipt_confirmed_at
	FROM orders o JOIN buyer_profiles bp ON bp.id=o.buyer_profile_id JOIN delivery_packages p ON p.order_id=o.id
	WHERE o.id=$1 AND p.qr_status='ACTIVE' FOR UPDATE`, orderID).Scan(&owner, &pkg, &scanned, &confirmed)
	if err != nil || owner != userID {
		return ErrQRForbidden
	}
	if confirmed != nil {
		return nil
	}
	if scanned == nil {
		return ErrQRDeliveryNotScanned
	}

	if _, err = tx.Exec(`UPDATE delivery_packages SET receipt_confirmed_at=NOW(),updated_at=NOW() WHERE id=$1`, pkg); err != nil {
		return err
	}
	if s.orderSvc != nil {
		if err = applyTransitionTx(tx, orderID, userID, models.OrderStatusReceived, "Buyer confirmed receipt after delivery QR scan", "BUYER"); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(`UPDATE orders SET delivery_status='RECEIVED',updated_at=NOW() WHERE id=$1`, orderID); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}

	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeOrderReceived, map[string]interface{}{
			"package_id": pkg.String(), "delivery_received": true, "cash_payment_verified_separately": true,
		})
	}
	// Completion is gated on verified cash payment as well; this is a no-op until that lands.
	if s.orderSvc != nil {
		_, _ = s.orderSvc.CompleteIfReceivedAndPaid(orderID)
	}
	return nil
}

// AdminDeliveryOverview returns the package handover state plus its full scan history for
// Commerce Admin. The QR token is never included: admins need the reference and the state,
// not the secret that would let them impersonate a scan.
func (s *QRService) AdminDeliveryOverview(orderID uuid.UUID) (*models.AdminDeliveryOverview, error) {
	pkg, err := s.packageForOrder(orderID, false)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &models.AdminDeliveryOverview{OrderID: orderID, Events: []models.DeliveryScanEvent{}}, nil
		}
		return nil, err
	}
	events, err := s.ScanHistory(orderID)
	if err != nil {
		return nil, err
	}
	var courier *uuid.UUID
	_ = s.db.QueryRow(`SELECT assigned_courier_id FROM orders WHERE id=$1`, orderID).Scan(&courier)
	return &models.AdminDeliveryOverview{OrderID: orderID, Package: pkg, AssignedCourierID: courier, Events: events}, nil
}

func (s *QRService) ScanHistory(orderID uuid.UUID) ([]models.DeliveryScanEvent, error) {
	rows, err := s.db.Query(`SELECT id,scan_type,scan_result,reason,courier_id,latitude,longitude,COALESCE(device_id,''),created_at FROM delivery_scan_events WHERE order_id=$1 ORDER BY created_at DESC`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.DeliveryScanEvent{}
	for rows.Next() {
		var e models.DeliveryScanEvent
		if err = rows.Scan(&e.ID, &e.ScanType, &e.ScanResult, &e.Reason, &e.CourierID, &e.Latitude, &e.Longitude, &e.DeviceID, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
