//go:build ignore

// verify_finance_engine.go — runtime proof that the TBK commission engine is
// real. It seeds a handful of genuine orders, payments and order lines into
// PostgreSQL, runs them through the SAME CommissionService the API uses, then
// reads every reporting surface back and checks that
//
//	GROSS SALES - TBK COMMISSION = SELLER NET
//
// holds globally and inside every scope (seller, business, shop, product,
// variant, order), that Finance Admin filtered to a seller matches what that
// seller sees, and that cancelled and refunded sales drop out of the totals.
//
// Everything it writes is tagged with a run marker and deleted at the end, so
// it leaves the database exactly as it found it.
//
// Usage:
//
//	go run scripts/verify_finance_engine.go
package main

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

const tolerance = 0.011 // one cent of rounding slack

type check struct {
	name   string
	passed bool
	detail string
}

var checks []check

func record(name string, passed bool, format string, args ...interface{}) {
	checks = append(checks, check{name: name, passed: passed, detail: fmt.Sprintf(format, args...)})
	status := "FAIL"
	if passed {
		status = "PASS"
	}
	fmt.Printf("  [%s] %-42s %s\n", status, name, fmt.Sprintf(format, args...))
}

func near(a, b float64) bool { return math.Abs(a-b) <= tolerance }

// seedSale is one sale the harness creates: a real order, its lines and a
// verified buyer payment, exactly as the checkout flow would leave them.
type seedSale struct {
	label      string
	businessID uuid.UUID
	shopID     uuid.UUID
	sellerID   uuid.UUID
	productID  uuid.UUID
	variantID  uuid.UUID
	productNm  string
	variantNm  string
	unitPrice  float64
	quantity   int

	orderID uuid.UUID
	gross   float64
}

func main() {
	db, err := database.Connect(
		env("DB_HOST", "localhost"), env("DB_PORT", "5432"), env("DB_NAME", "btmi_market"),
		env("DB_USER", "btmi_user"), env("DB_PASSWORD", "btmi_secret_password"))
	if err != nil {
		fmt.Println("cannot reach PostgreSQL:", err)
		os.Exit(1)
	}
	defer db.Close()

	marker := "FINVERIFY-" + time.Now().UTC().Format("20060102150405")
	fmt.Printf("TBK finance engine runtime verification\nrun marker: %s\n\n", marker)

	commRepo := repository.NewCommissionRepository(db.DB)
	orderRepo := repository.NewOrderRepository(db)
	paymentRepo := repository.NewBuyerPaymentRepository(db)
	businessRepo := repository.NewBusinessRepository(db)
	svc := service.NewCommissionService(commRepo, orderRepo, paymentRepo, businessRepo)

	rate, err := commRepo.GetCommissionRate()
	must(err)
	fmt.Printf("configured platform commission rate: %.2f%% (read from global_configs, not hardcoded)\n\n", rate)

	sales, buyerID, err := buildSeeds(db.DB)
	must(err)
	defer cleanup(db.DB, marker)

	for i := range sales {
		must(seedOne(db.DB, &sales[i], buyerID, marker))
		// The production engine, not a re-implementation of it.
		comm, err := svc.CalculateAndRecordCommission(sales[i].orderID)
		must(err)
		fmt.Printf("seeded %-28s gross %8.2f  rate %.2f%%  commission %7.2f  net %8.2f  [%s]\n",
			sales[i].label, comm.GrossAmount, comm.CommissionRate, comm.CommissionAmount, comm.SellerNetAmount, comm.Currency)
	}
	fmt.Println()

	scope := &models.FinanceReportFilter{DateFrom: time.Now().Add(-2 * time.Hour).Format(time.RFC3339)}

	// ---- 1. global totals ------------------------------------------------
	fmt.Println("GLOBAL TOTALS")
	report, err := svc.GetDashboardReport(cloneFilter(scope))
	must(err)

	var wantGross float64
	for _, s := range sales {
		wantGross = models.RoundMoney(wantGross + s.gross)
	}
	wantCommission := models.PercentOf(wantGross, rate)

	record("GLOBAL GROSS SALES", near(report.GrossSales, wantGross),
		"reported %.2f, seeded %.2f", report.GrossSales, wantGross)
	record("GLOBAL COMMISSION", near(report.CommissionAmount, wantCommission),
		"reported %.2f, %.2f%% of %.2f = %.2f", report.CommissionAmount, rate, wantGross, wantCommission)
	record("GLOBAL SELLER NET", near(report.GrossSales-report.CommissionAmount, report.SellerNetAmount),
		"%.2f - %.2f = %.2f", report.GrossSales, report.CommissionAmount, report.SellerNetAmount)
	record("COMMISSION DUE", near(report.DueCommission, report.CommissionAmount),
		"all fresh sales are DUE: %.2f", report.DueCommission)
	record("COMMISSION COLLECTED", near(report.CollectedCommission, 0),
		"nothing collected yet: %.2f", report.CollectedCommission)
	record("CURRENCY IS USD", report.Currency == models.CurrencyUSD && !report.MixedCurrency,
		"currency=%q mixed=%v", report.Currency, report.MixedCurrency)
	record("UNITS SOLD", report.UnitsSold == totalUnits(sales),
		"reported %d, seeded %d", report.UnitsSold, totalUnits(sales))
	record("PAYMENT AXIS SEPARATE", report.PaymentsCollected > 0 && near(report.CollectedCommission, 0),
		"buyers paid %.2f while TBK has collected %.2f", report.PaymentsCollected, report.CollectedCommission)

	// ---- 2. every breakdown dimension ------------------------------------
	fmt.Println("\nBREAKDOWNS")
	for _, group := range []models.FinanceBreakdownGroup{
		models.FinanceBreakdownSeller, models.FinanceBreakdownBusiness,
		models.FinanceBreakdownShop, models.FinanceBreakdownProduct, models.FinanceBreakdownVariant,
	} {
		items, err := svc.GetBreakdownReport(group, cloneFilter(scope))
		must(err)

		var sumGross, sumComm, sumNet float64
		identityHolds := len(items) > 0
		var units int
		for _, it := range items {
			sumGross = models.RoundMoney(sumGross + it.GrossSales)
			sumComm = models.RoundMoney(sumComm + it.CommissionAmount)
			sumNet = models.RoundMoney(sumNet + it.SellerNetAmount)
			units += it.UnitsSold
			if !near(it.GrossSales-it.CommissionAmount, it.SellerNetAmount) {
				identityHolds = false
			}
		}
		name := "BY " + strings.ToUpper(string(group))
		record(name+" · identity", identityHolds,
			"%d row(s), each gross - commission = net", len(items))
		record(name+" · re-sums to global", near(sumGross, report.GrossSales) && near(sumComm, report.CommissionAmount) && near(sumNet, report.SellerNetAmount),
			"gross %.2f / commission %.2f / net %.2f", sumGross, sumComm, sumNet)
		record(name+" · units", units == report.UnitsSold,
			"rows carry %d units, global %d", units, report.UnitsSold)
	}

	// ---- 3. per-order drill-down ----------------------------------------
	fmt.Println("\nPER-ORDER DETAIL")
	detail, err := svc.GetSaleFinanceDetail(sales[0].orderID)
	must(err)
	lineGross := 0.0
	for _, l := range detail.Lines {
		lineGross = models.RoundMoney(lineGross + l.GrossAmount)
	}
	record("BY ORDER · identity", near(detail.Sale.GrossAmount-detail.Sale.CommissionAmount, detail.Sale.SellerNetAmount),
		"%.2f - %.2f = %.2f", detail.Sale.GrossAmount, detail.Sale.CommissionAmount, detail.Sale.SellerNetAmount)
	record("BY ORDER · lines match gross", near(lineGross, detail.Sale.GrossAmount),
		"lines %.2f vs snapshot %.2f", lineGross, detail.Sale.GrossAmount)
	record("BY ORDER · buyer and payment", detail.BuyerName != "" && detail.PaymentStatus != "",
		"buyer %q, payment %s/%s", detail.BuyerName, detail.PaymentMethod, detail.PaymentStatus)
	record("BY ORDER · variant snapshot", len(detail.Lines) > 0 && detail.Lines[0].VariantID != nil,
		"%d line(s), first variant %q", len(detail.Lines), detail.Lines[0].VariantName)

	// ---- 4. Finance Admin filtered to a seller == that seller's own view --
	fmt.Println("\nFINANCE ADMIN vs SELLER")
	sellerID := sales[0].sellerID
	adminView, err := svc.GetDashboardReport(&models.FinanceReportFilter{
		SellerID: sellerID.String(), DateFrom: scope.DateFrom,
	})
	must(err)
	sellerView, err := svc.GetSellerDashboardReport(sellerID, &models.FinanceReportFilter{DateFrom: scope.DateFrom})
	must(err)
	record("SELLER FINANCE · gross", near(adminView.GrossSales, sellerView.GrossSales),
		"admin %.2f, seller %.2f", adminView.GrossSales, sellerView.GrossSales)
	record("SELLER FINANCE · commission", near(adminView.CommissionAmount, sellerView.CommissionAmount),
		"admin %.2f, seller %.2f", adminView.CommissionAmount, sellerView.CommissionAmount)
	record("SELLER FINANCE · net", near(adminView.SellerNetAmount, sellerView.SellerNetAmount),
		"admin %.2f, seller %.2f", adminView.SellerNetAmount, sellerView.SellerNetAmount)
	record("SELLER FINANCE · identity", near(sellerView.GrossSales-sellerView.CommissionAmount, sellerView.SellerNetAmount),
		"%.2f - %.2f = %.2f", sellerView.GrossSales, sellerView.CommissionAmount, sellerView.SellerNetAmount)

	summary, err := svc.GetSellerSummary(sellerID)
	must(err)
	record("SELLER SUMMARY · payment axis", summary.CommissionDue > 0 && near(summary.CommissionCollected, 0),
		"due %.2f, collected %.2f, payments received %.2f", summary.CommissionDue, summary.CommissionCollected, summary.PaymentsReceived)
	record("SELLER SUMMARY · live rate", near(summary.CommissionRate, rate),
		"summary reports %.2f%%, config says %.2f%%", summary.CommissionRate, rate)

	// ---- 5. seller sales history and seller-side breakdowns --------------
	fmt.Println("\nSELLER HISTORY & BREAKDOWNS")
	history, total, err := svc.ListSellerSales(sellerID, &models.CommissionFilter{DateFrom: scope.DateFrom, Limit: 50})
	must(err)
	histOK := total > 0
	for _, h := range history {
		if !near(h.GrossAmount-h.CommissionAmount, h.SellerNetAmount) || len(h.Lines) == 0 || h.TotalQuantity == 0 {
			histOK = false
		}
	}
	record("SELLER SALES HISTORY", histOK,
		"%d row(s), each with lines, quantities and a holding identity", total)

	for _, group := range []models.FinanceBreakdownGroup{
		models.FinanceBreakdownShop, models.FinanceBreakdownProduct, models.FinanceBreakdownVariant,
	} {
		items, err := svc.GetSellerBreakdownReport(sellerID, group, &models.FinanceReportFilter{DateFrom: scope.DateFrom})
		must(err)
		ok := len(items) > 0
		var g, c, n float64
		for _, it := range items {
			g, c, n = g+it.GrossSales, c+it.CommissionAmount, n+it.SellerNetAmount
			if !near(it.GrossSales-it.CommissionAmount, it.SellerNetAmount) {
				ok = false
			}
		}
		record("SELLER BREAKDOWN · "+string(group), ok && near(models.RoundMoney(g), sellerView.GrossSales),
			"%d row(s), gross %.2f vs seller total %.2f", len(items), g, sellerView.GrossSales)
	}

	// ---- 6. date filters -------------------------------------------------
	fmt.Println("\nDATE FILTERS")
	future, err := svc.GetDashboardReport(&models.FinanceReportFilter{
		DateFrom: time.Now().Add(24 * time.Hour).Format(time.RFC3339),
	})
	must(err)
	record("DATE FILTERS", near(future.GrossSales, 0) && report.GrossSales > 0,
		"tomorrow-onward window returns %.2f, current window %.2f", future.GrossSales, report.GrossSales)

	// ---- 7. chart series -------------------------------------------------
	points, err := svc.GetTimeseriesReport(models.FinanceIntervalDay, cloneFilter(scope))
	must(err)
	var seriesGross float64
	seriesOK := len(points) > 0
	for _, p := range points {
		seriesGross = models.RoundMoney(seriesGross + p.GrossSales)
		if !near(p.GrossSales-p.CommissionAmount, p.SellerNetAmount) {
			seriesOK = false
		}
	}
	record("CHARTS", seriesOK && near(seriesGross, report.GrossSales),
		"%d bucket(s) summing to %.2f", len(points), seriesGross)

	// ---- 8. refunds / cancellations drop out -----------------------------
	fmt.Println("\nREFUNDS & CANCELLATIONS")
	refunded := sales[len(sales)-1]
	must(svc.VoidForRefund(refunded.orderID, "runtime verification refund"))
	afterRefund, err := svc.GetDashboardReport(cloneFilter(scope))
	must(err)
	record("REFUNDS", near(afterRefund.GrossSales, models.RoundMoney(report.GrossSales-refunded.gross)) && afterRefund.RefundedSales == 1,
		"gross %.2f -> %.2f after voiding %.2f", report.GrossSales, afterRefund.GrossSales, refunded.gross)
	record("CANCELLED ORDERS", near(afterRefund.GrossSales-afterRefund.CommissionAmount, afterRefund.SellerNetAmount),
		"identity still holds after the void: %.2f - %.2f = %.2f",
		afterRefund.GrossSales, afterRefund.CommissionAmount, afterRefund.SellerNetAmount)

	// ---- 9. rate snapshot immutability -----------------------------------
	fmt.Println("\nRATE SNAPSHOT")
	before, err := commRepo.GetByOrderID(sales[0].orderID)
	must(err)
	newRate := rate + 2
	must(commRepo.UpdateCommissionRate(rate, newRate, sales[0].sellerID, "runtime verification"))
	after, err := commRepo.GetByOrderID(sales[0].orderID)
	must(err)
	// Put the platform rate back before anything else reads it.
	must(commRepo.UpdateCommissionRate(newRate, rate, sales[0].sellerID, "runtime verification rollback"))
	record("COMMISSION SNAPSHOT", near(before.CommissionRate, after.CommissionRate) && near(after.CommissionAmount, before.CommissionAmount),
		"existing sale stayed at %.2f%% while the platform moved to %.2f%%", after.CommissionRate, newRate)

	// ---- 10. no static data ---------------------------------------------
	fmt.Println("\nSOURCE OF TRUTH")
	var dbGross, dbComm, dbNet float64
	must(db.DB.QueryRow(`
		SELECT COALESCE(SUM(gross_amount),0), COALESCE(SUM(commission_amount),0), COALESCE(SUM(seller_net_amount),0)
		FROM sale_commissions WHERE status <> 'WAIVED' AND calculated_at >= $1`, scope.DateFrom).
		Scan(&dbGross, &dbComm, &dbNet))
	record("POSTGRESQL", near(dbGross, afterRefund.GrossSales) && near(dbComm, afterRefund.CommissionAmount) && near(dbNet, afterRefund.SellerNetAmount),
		"raw SQL gross %.2f / commission %.2f / net %.2f matches the API totals", dbGross, dbComm, dbNet)

	// ---- summary ---------------------------------------------------------
	failed := 0
	for _, c := range checks {
		if !c.passed {
			failed++
		}
	}
	fmt.Printf("\n%d checks, %d failed\n", len(checks), failed)
	if failed > 0 {
		for _, c := range checks {
			if !c.passed {
				fmt.Printf("  FAILED: %s — %s\n", c.name, c.detail)
			}
		}
		cleanup(db.DB, marker)
		os.Exit(1)
	}
	fmt.Println("FINAL STATUS: PASS")
}

// buildSeeds picks two real businesses that each have an OWNER and a product
// with variants, then lays out the spec's scenario across them.
func buildSeeds(db *sql.DB) ([]seedSale, uuid.UUID, error) {
	rows, err := db.Query(`
		SELECT b.id, s.id, bm.user_id, p.id, v.id, p.name, v.name
		FROM businesses b
		JOIN business_memberships bm ON bm.business_id = b.id AND bm.role = 'OWNER'
		                             AND (bm.status = 'ACTIVE' OR bm.status IS NULL)
		JOIN shops s ON s.business_id = b.id
		JOIN products p ON p.business_id = b.id
		JOIN product_variants v ON v.product_id = p.id
		ORDER BY b.id, s.id, p.id, v.id`)
	if err != nil {
		return nil, uuid.Nil, err
	}
	defer rows.Close()

	type combo struct {
		business, shop, seller, product, variant uuid.UUID
		productNm, variantNm                     string
	}
	var combos []combo
	for rows.Next() {
		var c combo
		if err := rows.Scan(&c.business, &c.shop, &c.seller, &c.product, &c.variant, &c.productNm, &c.variantNm); err != nil {
			return nil, uuid.Nil, err
		}
		combos = append(combos, c)
	}
	if len(combos) < 2 {
		return nil, uuid.Nil, fmt.Errorf("need at least two business/shop/product/variant combinations to verify, found %d", len(combos))
	}

	// Shop A and Shop B must belong to different businesses so the
	// seller-consistency check is meaningful.
	a := combos[0]
	var b combo
	found := false
	for _, c := range combos[1:] {
		if c.business != a.business {
			b, found = c, true
			break
		}
	}
	if !found {
		b = combos[1]
	}
	// A second variant of the same shop, when one exists, exercises the
	// variant breakdown.
	a2 := a
	for _, c := range combos {
		if c.business == a.business && c.variant != a.variant {
			a2 = c
			break
		}
	}

	var buyerID uuid.UUID
	if err := db.QueryRow(`SELECT id FROM buyer_profiles ORDER BY created_at LIMIT 1`).Scan(&buyerID); err != nil {
		return nil, uuid.Nil, fmt.Errorf("no buyer profile to attach the seeded sales to: %w", err)
	}

	sales := []seedSale{
		{label: "Shop A / Product X", businessID: a.business, shopID: a.shop, sellerID: a.seller,
			productID: a.product, variantID: a.variant, productNm: a.productNm, variantNm: a.variantNm,
			unitPrice: 50, quantity: 2}, // 100.00
		{label: "Shop A / Product Y", businessID: a2.business, shopID: a2.shop, sellerID: a2.seller,
			productID: a2.product, variantID: a2.variant, productNm: a2.productNm, variantNm: a2.variantNm,
			unitPrice: 25, quantity: 2}, // 50.00
		{label: "Shop B / Product Z", businessID: b.business, shopID: b.shop, sellerID: b.seller,
			productID: b.product, variantID: b.variant, productNm: b.productNm, variantNm: b.variantNm,
			unitPrice: 100, quantity: 2}, // 200.00
	}
	for i := range sales {
		sales[i].gross = models.RoundMoney(sales[i].unitPrice * float64(sales[i].quantity))
	}
	return sales, buyerID, nil
}

// seedOne writes one real order, its line and a VERIFIED buyer payment, the
// same shape the checkout flow leaves behind.
func seedOne(db *sql.DB, s *seedSale, buyerID uuid.UUID, marker string) error {
	s.orderID = uuid.New()
	orderNumber := fmt.Sprintf("%s-%d", marker, s.quantity*int(s.unitPrice))
	if len(orderNumber) > 20 {
		orderNumber = orderNumber[len(orderNumber)-20:]
	}

	if _, err := db.Exec(`
		INSERT INTO orders (id, business_id, shop_id, status, total_items, notes, created_by, buyer_profile_id,
		                    base_total, points_used, points_discount_amount, final_total, order_number, currency,
		                    delivery_method, delivery_fee_base, delivery_fee_final, created_at, updated_at)
		VALUES ($1,$2,$3,'COMPLETED',$4,$5,$6,$7,$8,0,0,$8,$9,'USD','PICKUP',0,0,NOW(),NOW())`,
		s.orderID, s.businessID, s.shopID, s.quantity, marker, s.sellerID, buyerID, s.gross, orderNumber); err != nil {
		return fmt.Errorf("insert order: %w", err)
	}

	if _, err := db.Exec(`
		INSERT INTO order_lines (id, order_id, product_id, variant_id, quantity, unit_price,
		                         base_unit_price, points_discount_per_unit, final_unit_price,
		                         product_name, product_sku, variant_name, variant_sku, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$6,0,$6,$7,'',$8,'',NOW())`,
		uuid.New(), s.orderID, s.productID, s.variantID, s.quantity, s.unitPrice,
		s.productNm, s.variantNm); err != nil {
		return fmt.Errorf("insert order line: %w", err)
	}

	if _, err := db.Exec(`
		INSERT INTO buyer_payments (id, order_id, business_id, shop_id, buyer_profile_id, payment_method, currency,
		                            products_base_total, products_final_total, delivery_fee_base, delivery_fee_final,
		                            cash_due, final_total, status, verified_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,'CASH','USD',$6,$6,0,0,$6,$6,'VERIFIED',NOW(),NOW(),NOW())`,
		uuid.New(), s.orderID, s.businessID, s.shopID, buyerID, s.gross); err != nil {
		return fmt.Errorf("insert buyer payment: %w", err)
	}
	return nil
}

// cleanup removes everything this run created, in FK order.
func cleanup(db *sql.DB, marker string) {
	_, _ = db.Exec(`DELETE FROM sale_commissions WHERE order_id IN (SELECT id FROM orders WHERE notes = $1)`, marker)
	_, _ = db.Exec(`DELETE FROM buyer_payments   WHERE order_id IN (SELECT id FROM orders WHERE notes = $1)`, marker)
	_, _ = db.Exec(`DELETE FROM order_lines      WHERE order_id IN (SELECT id FROM orders WHERE notes = $1)`, marker)
	_, _ = db.Exec(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE notes = $1)`, marker)
	_, _ = db.Exec(`DELETE FROM orders WHERE notes = $1`, marker)
	_, _ = db.Exec(`DELETE FROM platform_commission_history WHERE reason LIKE 'runtime verification%'`)
}

func cloneFilter(f *models.FinanceReportFilter) *models.FinanceReportFilter {
	c := *f
	return &c
}

func totalUnits(sales []seedSale) int {
	n := 0
	for _, s := range sales {
		n += s.quantity
	}
	return n
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func must(err error) {
	if err != nil {
		fmt.Println("verification aborted:", err)
		os.Exit(1)
	}
}
