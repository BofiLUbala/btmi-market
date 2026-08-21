package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type CashRepository struct {
	db *database.DB
}

func NewCashRepository(db *database.DB) *CashRepository {
	return &CashRepository{db: db}
}

func (r *CashRepository) CreateSession(session *models.CashSession) error {
	query := `
		INSERT INTO cash_sessions (id, business_id, shop_id, employee_id, opened_at, opening_amount, currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at
	`

	session.ID = uuid.New()
	session.OpenedAt = time.Now()
	if session.Currency == "" {
		session.Currency = "USD"
	}
	session.Status = models.CashSessionStatusOpen

	return r.db.QueryRow(query,
		session.ID, session.BusinessID, session.ShopID, session.EmployeeID,
		session.OpenedAt, session.OpeningAmount, session.Currency, session.Status,
	).Scan(&session.CreatedAt, &session.UpdatedAt)
}

func (r *CashRepository) scanSessionRow(row interface{ Scan(...interface{}) error }) (*models.CashSession, error) {
	session := &models.CashSession{}
	var empID sql.NullString
	err := row.Scan(
		&session.ID, &session.BusinessID, &session.ShopID, &empID,
		&session.OpenedAt, &session.ClosedAt,
		&session.OpeningAmount, &session.Currency, &session.CashSalesTotal, &session.ExpectedAmount,
		&session.DeclaredClosingAmount, &session.Difference, &session.ReconciliationResult, &session.Status,
		&session.CreatedAt, &session.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if empID.Valid {
		id, err := uuid.Parse(empID.String)
		if err == nil {
			session.EmployeeID = &id
		}
	}
	return session, nil
}

func (r *CashRepository) GetSessionByID(id uuid.UUID) (*models.CashSession, error) {
	query := `
		SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
			opening_amount, currency, cash_sales_total, expected_amount,
			declared_closing_amount, difference, reconciliation_result, status,
			created_at, updated_at
		FROM cash_sessions WHERE id = $1
	`

	session, err := r.scanSessionRow(r.db.QueryRow(query, id))
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("cash_session_not_found")
	}
	return session, err
}

func (r *CashRepository) GetOpenSessionByEmployeeShop(employeeID *uuid.UUID, shopID uuid.UUID) (*models.CashSession, error) {
	var query string
	var args []interface{}

	if employeeID != nil {
		query = `
			SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
				opening_amount, currency, cash_sales_total, expected_amount,
				declared_closing_amount, difference, reconciliation_result, status,
				created_at, updated_at
			FROM cash_sessions WHERE employee_id = $1 AND shop_id = $2 AND status = 'OPEN'
		`
		args = append(args, *employeeID, shopID)
	} else {
		query = `
			SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
				opening_amount, currency, cash_sales_total, expected_amount,
				declared_closing_amount, difference, reconciliation_result, status,
				created_at, updated_at
			FROM cash_sessions WHERE employee_id IS NULL AND shop_id = $1 AND status = 'OPEN'
		`
		args = append(args, shopID)
	}

	session, err := r.scanSessionRow(r.db.QueryRow(query, args...))
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("cash_session_not_found")
	}
	return session, err
}

func (r *CashRepository) GetOpenSessionByShop(shopID uuid.UUID) (*models.CashSession, error) {
	query := `
		SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
			opening_amount, currency, cash_sales_total, expected_amount,
			declared_closing_amount, difference, reconciliation_result, status,
			created_at, updated_at
		FROM cash_sessions WHERE shop_id = $1 AND status = 'OPEN'
		ORDER BY opened_at DESC LIMIT 1
	`

	session, err := r.scanSessionRow(r.db.QueryRow(query, shopID))
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("cash_session_not_found")
	}
	return session, err
}

func (r *CashRepository) CloseSession(sessionID uuid.UUID, declaredAmount float64) error {
	now := time.Now()
	query := `
		UPDATE cash_sessions
		SET closed_at = $2, declared_closing_amount = $3, status = 'CLOSED', updated_at = NOW()
		WHERE id = $1 AND status = 'OPEN'
	`

	result, err := r.db.Exec(query, sessionID, now, declaredAmount)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("cash_session_not_found_or_not_open")
	}
	return nil
}

func (r *CashRepository) ReconcileSession(sessionID uuid.UUID, difference float64, result string) error {
	query := `
		UPDATE cash_sessions
		SET difference = $2, reconciliation_result = $3, status = 'RECONCILED', updated_at = NOW()
		WHERE id = $1 AND status = 'CLOSED'
	`

	res, err := r.db.Exec(query, sessionID, difference, result)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("cash_session_not_found_or_not_closed")
	}
	return nil
}

func (r *CashRepository) UpdateSessionSalesTotal(sessionID uuid.UUID) error {
	query := `
		UPDATE cash_sessions
		SET cash_sales_total = (
			SELECT COALESCE(SUM(amount), 0) FROM cash_payments
			WHERE cash_session_id = $1 AND status = 'CONFIRMED'
		), updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(query, sessionID)
	return err
}

func (r *CashRepository) RecalculateExpected(sessionID uuid.UUID) error {
	query := `
		UPDATE cash_sessions
		SET expected_amount = opening_amount + cash_sales_total, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(query, sessionID)
	return err
}

func (r *CashRepository) ListSessionsByShop(shopID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM cash_sessions WHERE shop_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, shopID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
			opening_amount, currency, cash_sales_total, expected_amount,
			declared_closing_amount, difference, reconciliation_result, status,
			created_at, updated_at
		FROM cash_sessions WHERE shop_id = $1
		ORDER BY opened_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, shopID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	return r.scanSessions(rows, total)
}

func (r *CashRepository) ListSessionsByEmployee(employeeID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM cash_sessions WHERE employee_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, employeeID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
			opening_amount, currency, cash_sales_total, expected_amount,
			declared_closing_amount, difference, reconciliation_result, status,
			created_at, updated_at
		FROM cash_sessions WHERE employee_id = $1
		ORDER BY opened_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, employeeID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	return r.scanSessions(rows, total)
}

func (r *CashRepository) ListSessionsByBusiness(businessID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM cash_sessions WHERE business_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, businessID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, business_id, shop_id, employee_id, opened_at, closed_at,
			opening_amount, currency, cash_sales_total, expected_amount,
			declared_closing_amount, difference, reconciliation_result, status,
			created_at, updated_at
		FROM cash_sessions WHERE business_id = $1
		ORDER BY opened_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, businessID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	return r.scanSessions(rows, total)
}

func (r *CashRepository) scanSessions(rows *sql.Rows, total int) ([]models.CashSession, int, error) {
	var sessions []models.CashSession
	for rows.Next() {
		var empID sql.NullString
		var s models.CashSession
		err := rows.Scan(
			&s.ID, &s.BusinessID, &s.ShopID, &empID,
			&s.OpenedAt, &s.ClosedAt,
			&s.OpeningAmount, &s.Currency, &s.CashSalesTotal, &s.ExpectedAmount,
			&s.DeclaredClosingAmount, &s.Difference, &s.ReconciliationResult, &s.Status,
			&s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if empID.Valid {
			id, err := uuid.Parse(empID.String)
			if err == nil {
				s.EmployeeID = &id
			}
		}
		sessions = append(sessions, s)
	}
	return sessions, total, nil
}

func (r *CashRepository) CreatePayment(payment *models.CashPayment) error {
	query := `
		INSERT INTO cash_payments (id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at
	`

	payment.ID = uuid.New()
	if payment.Currency == "" {
		payment.Currency = "USD"
	}
	if payment.Status == "" {
		payment.Status = models.CashPaymentStatusConfirmed
	}

	return r.db.QueryRow(query,
		payment.ID, payment.BusinessID, payment.ShopID, payment.EmployeeID, payment.CustomerID, payment.CashSessionID,
		payment.ReferenceType, payment.ReferenceID, payment.Amount, payment.Currency, payment.Status,
	).Scan(&payment.CreatedAt, &payment.UpdatedAt)
}

func (r *CashRepository) GetPaymentByID(id uuid.UUID) (*models.CashPayment, error) {
	query := `
		SELECT id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status, created_at, updated_at
		FROM cash_payments WHERE id = $1
	`

	payment := &models.CashPayment{}
	var empID, custID, sessID sql.NullString
	err := r.db.QueryRow(query, id).Scan(
		&payment.ID, &payment.BusinessID, &payment.ShopID, &empID,
		&custID, &sessID,
		&payment.ReferenceType, &payment.ReferenceID, &payment.Amount, &payment.Currency,
		&payment.Status, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("cash_payment_not_found")
	}
	if empID.Valid {
		id, _ := uuid.Parse(empID.String)
		payment.EmployeeID = &id
	}
	if custID.Valid {
		id, _ := uuid.Parse(custID.String)
		payment.CustomerID = &id
	}
	if sessID.Valid {
		id, _ := uuid.Parse(sessID.String)
		payment.CashSessionID = &id
	}
	return payment, err
}

func (r *CashRepository) GetPaymentsByOrder(orderID uuid.UUID) ([]models.CashPayment, error) {
	query := `
		SELECT id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status, created_at, updated_at
		FROM cash_payments WHERE reference_id = $1 AND reference_type = 'ORDER'
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.CashPayment
	for rows.Next() {
		var p models.CashPayment
		err := rows.Scan(
			&p.ID, &p.BusinessID, &p.ShopID, &p.EmployeeID,
			&p.CustomerID, &p.CashSessionID,
			&p.ReferenceType, &p.ReferenceID, &p.Amount, &p.Currency,
			&p.Status, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, rows.Err()
}

func (r *CashRepository) GetPaymentsBySession(sessionID uuid.UUID) ([]models.CashPayment, error) {
	query := `
		SELECT id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status, created_at, updated_at
		FROM cash_payments WHERE cash_session_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.CashPayment
	for rows.Next() {
		var p models.CashPayment
		err := rows.Scan(
			&p.ID, &p.BusinessID, &p.ShopID, &p.EmployeeID,
			&p.CustomerID, &p.CashSessionID,
			&p.ReferenceType, &p.ReferenceID, &p.Amount, &p.Currency,
			&p.Status, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, nil
}

func (r *CashRepository) ListPaymentsByShop(shopID uuid.UUID, page, limit int) ([]models.CashPayment, int, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM cash_payments WHERE shop_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, shopID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status, created_at, updated_at
		FROM cash_payments WHERE shop_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, shopID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	return r.scanPayments(rows, total)
}

func (r *CashRepository) ListPaymentsByBusiness(businessID uuid.UUID, page, limit int) ([]models.CashPayment, int, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM cash_payments WHERE business_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, businessID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, business_id, shop_id, employee_id, customer_id, cash_session_id,
			reference_type, reference_id, amount, currency, status, created_at, updated_at
		FROM cash_payments WHERE business_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, businessID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	return r.scanPayments(rows, total)
}

func (r *CashRepository) GetBusinessCashSummary(businessID uuid.UUID) (*models.CashSummaryResponse, error) {
	shopQuery := `
		SELECT s.id, s.name,
			COALESCE(SUM(cp.amount), 0) as total_cash_sales
		FROM shops s
		LEFT JOIN cash_payments cp ON cp.shop_id = s.id AND cp.status = 'CONFIRMED'
		WHERE s.business_id = $1
		GROUP BY s.id, s.name
		ORDER BY s.name
	`

	rows, err := r.db.Query(shopQuery, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var totalCash float64
	var shopBreakdown []models.CashSummaryShop

	for rows.Next() {
		var shop models.CashSummaryShop
		if err := rows.Scan(&shop.ShopID, &shop.ShopName, &shop.TotalCashSales); err != nil {
			return nil, err
		}
		totalCash += shop.TotalCashSales

		openCount, _ := r.countSessionsByShopStatus(shop.ShopID, "OPEN")
		closedCount, _ := r.countSessionsByShopStatus(shop.ShopID, "CLOSED")
		shop.OpenSessions = openCount
		shop.ClosedSessions = closedCount

		shortage, overage, _ := r.getShopShortageOverage(shop.ShopID)
		shop.TotalShortage = shortage
		shop.TotalOverage = overage

		shopBreakdown = append(shopBreakdown, shop)
	}

	sellerQuery := `
		SELECT e.id, e.first_name, e.last_name,
			COALESCE(SUM(cp.amount), 0) as total_cash_sales
		FROM employees e
		LEFT JOIN cash_payments cp ON cp.employee_id = e.id AND cp.status = 'CONFIRMED'
		WHERE e.business_id = $1
		GROUP BY e.id, e.first_name, e.last_name
		HAVING SUM(cp.amount) > 0
		ORDER BY total_cash_sales DESC
	`

	sRows, err := r.db.Query(sellerQuery, businessID)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	var sellerBreakdown []models.CashSummarySeller
	for sRows.Next() {
		var seller models.CashSummarySeller
		if err := sRows.Scan(&seller.EmployeeID, &seller.FirstName, &seller.LastName, &seller.TotalCashSales); err != nil {
			return nil, err
		}
		sellerBreakdown = append(sellerBreakdown, seller)
	}

	return &models.CashSummaryResponse{
		BusinessID:      businessID,
		TotalCashSales:  totalCash,
		ShopBreakdown:   shopBreakdown,
		SellerBreakdown: sellerBreakdown,
	}, nil
}

func (r *CashRepository) GetShopCashSummary(shopID uuid.UUID) (*models.CashSummaryShop, error) {
	shopQuery := `
		SELECT s.id, s.name,
			COALESCE(SUM(cp.amount), 0) as total_cash_sales
		FROM shops s
		LEFT JOIN cash_payments cp ON cp.shop_id = s.id AND cp.status = 'CONFIRMED'
		WHERE s.id = $1
		GROUP BY s.id, s.name
	`

	shop := &models.CashSummaryShop{}
	err := r.db.QueryRow(shopQuery, shopID).Scan(&shop.ShopID, &shop.ShopName, &shop.TotalCashSales)
	if err != nil {
		return nil, err
	}

	openCount, _ := r.countSessionsByShopStatus(shopID, "OPEN")
	closedCount, _ := r.countSessionsByShopStatus(shopID, "CLOSED")
	shop.OpenSessions = openCount
	shop.ClosedSessions = closedCount

	shortage, overage, _ := r.getShopShortageOverage(shopID)
	shop.TotalShortage = shortage
	shop.TotalOverage = overage

	sellerQuery := `
		SELECT e.id, e.first_name, e.last_name,
			COALESCE(SUM(cp.amount), 0) as total_cash_sales
		FROM employees e
		LEFT JOIN cash_payments cp ON cp.employee_id = e.id AND cp.status = 'CONFIRMED'
		WHERE e.id IN (SELECT employee_id FROM cash_sessions WHERE shop_id = $1)
		GROUP BY e.id, e.first_name, e.last_name
		ORDER BY total_cash_sales DESC
	`

	sRows, err := r.db.Query(sellerQuery, shopID)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	var sellerBreakdown []models.CashSummarySeller
	for sRows.Next() {
		var seller models.CashSummarySeller
		if err := sRows.Scan(&seller.EmployeeID, &seller.FirstName, &seller.LastName, &seller.TotalCashSales); err != nil {
			return nil, err
		}
		sellerBreakdown = append(sellerBreakdown, seller)
	}
	shop.SellerBreakdown = sellerBreakdown

	return shop, nil
}

func (r *CashRepository) countSessionsByShopStatus(shopID uuid.UUID, status string) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM cash_sessions WHERE shop_id = $1 AND status = $2`, shopID, status).Scan(&count)
	return count, err
}

func (r *CashRepository) getShopShortageOverage(shopID uuid.UUID) (shortage float64, overage float64, err error) {
	query := `
		SELECT
			COALESCE(SUM(CASE WHEN difference < 0 THEN difference ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN difference > 0 THEN difference ELSE 0 END), 0)
		FROM cash_sessions WHERE shop_id = $1 AND status = 'RECONCILED'
	`
	err = r.db.QueryRow(query, shopID).Scan(&shortage, &overage)
	return
}

func (r *CashRepository) scanPayments(rows *sql.Rows, total int) ([]models.CashPayment, int, error) {
	var payments []models.CashPayment
	for rows.Next() {
		var p models.CashPayment
		var empID, custID, sessID sql.NullString
		err := rows.Scan(
			&p.ID, &p.BusinessID, &p.ShopID, &empID,
			&custID, &sessID,
			&p.ReferenceType, &p.ReferenceID, &p.Amount, &p.Currency,
			&p.Status, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if empID.Valid {
			id, _ := uuid.Parse(empID.String)
			p.EmployeeID = &id
		}
		if custID.Valid {
			id, _ := uuid.Parse(custID.String)
			p.CustomerID = &id
		}
		if sessID.Valid {
			id, _ := uuid.Parse(sessID.String)
			p.CashSessionID = &id
		}
		payments = append(payments, p)
	}
	return payments, total, nil
}
