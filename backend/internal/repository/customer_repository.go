package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type CustomerRepository struct {
	db *database.DB
}

func NewCustomerRepository(db *database.DB) *CustomerRepository {
	return &CustomerRepository{db: db}
}

func (r *CustomerRepository) Create(customer *models.Customer) error {
	query := `
		INSERT INTO customers (id, business_id, first_name, last_name, phone, email, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at, updated_at
	`
	if customer.ID == uuid.Nil {
		customer.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		customer.ID, customer.BusinessID, customer.FirstName, customer.LastName,
		customer.Phone, customer.Email, customer.Status,
	).Scan(&customer.CreatedAt, &customer.UpdatedAt)
}

func (r *CustomerRepository) GetByID(id uuid.UUID) (*models.Customer, error) {
	query := `
		SELECT id, business_id, first_name, last_name, phone, email, status, created_at, updated_at
		FROM customers WHERE id = $1
	`
	customer := &models.Customer{}
	err := r.db.QueryRow(query, id).Scan(
		&customer.ID, &customer.BusinessID, &customer.FirstName, &customer.LastName,
		&customer.Phone, &customer.Email, &customer.Status,
		&customer.CreatedAt, &customer.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("customer not found")
	}
	if err != nil {
		return nil, err
	}
	return customer, nil
}

func (r *CustomerRepository) GetByBusinessAndPhone(businessID uuid.UUID, phone string) (*models.Customer, error) {
	query := `
		SELECT id, business_id, first_name, last_name, phone, email, status, created_at, updated_at
		FROM customers WHERE business_id = $1 AND phone = $2
	`
	customer := &models.Customer{}
	err := r.db.QueryRow(query, businessID, phone).Scan(
		&customer.ID, &customer.BusinessID, &customer.FirstName, &customer.LastName,
		&customer.Phone, &customer.Email, &customer.Status,
		&customer.CreatedAt, &customer.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return customer, nil
}

func (r *CustomerRepository) GetByBusinessAndEmail(businessID uuid.UUID, email string) (*models.Customer, error) {
	query := `
		SELECT id, business_id, first_name, last_name, phone, email, status, created_at, updated_at
		FROM customers WHERE business_id = $1 AND email = $2
	`
	customer := &models.Customer{}
	err := r.db.QueryRow(query, businessID, email).Scan(
		&customer.ID, &customer.BusinessID, &customer.FirstName, &customer.LastName,
		&customer.Phone, &customer.Email, &customer.Status,
		&customer.CreatedAt, &customer.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return customer, nil
}

func (r *CustomerRepository) FindOrCreateByPhone(businessID uuid.UUID, phone, firstName, lastName string) (*models.Customer, error) {
	existing, err := r.GetByBusinessAndPhone(businessID, phone)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	customer := &models.Customer{
		BusinessID: businessID,
		FirstName:  firstName,
		LastName:   lastName,
		Phone:      &phone,
		Status:     models.CustomerStatusActive,
	}
	if err := r.Create(customer); err != nil {
		return nil, err
	}
	return customer, nil
}

func (r *CustomerRepository) Update(customer *models.Customer) error {
	query := `
		UPDATE customers
		SET first_name = $2, last_name = $3, phone = $4, email = $5, status = $6, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`
	return r.db.QueryRow(query,
		customer.ID, customer.FirstName, customer.LastName,
		customer.Phone, customer.Email, customer.Status,
	).Scan(&customer.UpdatedAt)
}

func (r *CustomerRepository) ListByBusiness(businessID uuid.UUID, search string, page, limit int) ([]*models.Customer, int, error) {
	where := []string{"business_id = $1"}
	args := []interface{}{businessID}
	argIdx := 2

	if search != "" {
		where = append(where, fmt.Sprintf("(LOWER(first_name) LIKE $%d OR LOWER(last_name) LIKE $%d OR phone LIKE $%d OR LOWER(email) LIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+strings.ToLower(search)+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM customers WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := 0
	if page > 1 {
		offset = (page - 1) * limit
	}

	query := fmt.Sprintf(`
		SELECT id, business_id, first_name, last_name, phone, email, status, created_at, updated_at
		FROM customers
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var customers []*models.Customer
	for rows.Next() {
		customer := &models.Customer{}
		err := rows.Scan(
			&customer.ID, &customer.BusinessID, &customer.FirstName, &customer.LastName,
			&customer.Phone, &customer.Email, &customer.Status,
			&customer.CreatedAt, &customer.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		customers = append(customers, customer)
	}

	return customers, total, rows.Err()
}

func (r *CustomerRepository) GetCustomerOrders(customerID uuid.UUID, shopID *uuid.UUID, status string, from, to *time.Time, page, limit int) ([]*models.CustomerOrderResponse, int, error) {
	where := []string{"o.customer_id = $1"}
	args := []interface{}{customerID}
	argIdx := 2

	if shopID != nil {
		where = append(where, fmt.Sprintf("o.shop_id = $%d", argIdx))
		args = append(args, *shopID)
		argIdx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("o.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if from != nil {
		where = append(where, fmt.Sprintf("o.created_at >= $%d", argIdx))
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		where = append(where, fmt.Sprintf("o.created_at <= $%d", argIdx))
		args = append(args, *to)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM orders o WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := 0
	if page > 1 {
		offset = (page - 1) * limit
	}

	query := fmt.Sprintf(`
		SELECT o.id, o.shop_id, s.name AS shop_name, o.status, o.total_items, o.notes, o.created_at,
			COALESCE(SUM(ol.quantity * ol.unit_price), 0) AS total_cost
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		LEFT JOIN order_lines ol ON ol.order_id = o.id
		WHERE %s
		GROUP BY o.id, o.shop_id, s.name, o.status, o.total_items, o.notes, o.created_at
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []*models.CustomerOrderResponse
	for rows.Next() {
		order := &models.CustomerOrderResponse{}
		err := rows.Scan(
			&order.ID, &order.ShopID, &order.ShopName, &order.Status,
			&order.TotalItems, &order.Notes, &order.CreatedAt, &order.TotalCost,
		)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, order)
	}

	return orders, total, rows.Err()
}

func (r *CustomerRepository) GetCustomerSummary(customerID uuid.UUID) (*models.CustomerSummaryResponse, error) {
	customer, err := r.GetByID(customerID)
	if err != nil {
		return nil, err
	}

	summary := &models.CustomerSummaryResponse{
		Customer: models.CustomerResponse{
			ID:         customer.ID,
			BusinessID: customer.BusinessID,
			FirstName:  customer.FirstName,
			LastName:   customer.LastName,
			Phone:      customer.Phone,
			Email:      customer.Email,
			Status:     string(customer.Status),
			CreatedAt:  customer.CreatedAt,
			UpdatedAt:  customer.UpdatedAt,
		},
	}

	statsQuery := `
		SELECT COUNT(o.id),
			COALESCE(SUM(sub.total_cost), 0),
			MIN(o.created_at),
			MAX(o.created_at)
		FROM orders o
		LEFT JOIN (
			SELECT order_id, SUM(quantity * unit_price) AS total_cost
			FROM order_lines GROUP BY order_id
		) sub ON sub.order_id = o.id
		WHERE o.customer_id = $1
	`
	err = r.db.QueryRow(statsQuery, customerID).Scan(
		&summary.TotalOrders, &summary.TotalPurchased,
		&summary.FirstPurchase, &summary.LastPurchase,
	)
	if err != nil {
		return nil, err
	}

	shopsQuery := `
		SELECT DISTINCT s.id, s.name
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		WHERE o.customer_id = $1
		ORDER BY s.name
	`
	rows, err := r.db.Query(shopsQuery, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		shop := models.ShopInfo{}
		if err := rows.Scan(&shop.ID, &shop.Name); err != nil {
			return nil, err
		}
		summary.ShopsUsed = append(summary.ShopsUsed, shop)
	}

	if summary.ShopsUsed == nil {
		summary.ShopsUsed = []models.ShopInfo{}
	}

	return summary, nil
}
