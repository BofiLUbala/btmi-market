package repository

import (
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type StockMovementRepository struct {
	db *database.DB
}

func NewStockMovementRepository(db *database.DB) *StockMovementRepository {
	return &StockMovementRepository{db: db}
}

func (r *StockMovementRepository) Create(movement *models.StockMovement) error {
	query := `
		INSERT INTO stock_movements (id, business_id, shop_id, product_id, variant_id, movement_type, quantity, previous_quantity, new_quantity, reference_id, notes, performed_by, employee_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at
	`

	movement.ID = uuid.New()
	movement.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		movement.ID, movement.BusinessID, movement.ShopID, movement.ProductID,
		movement.VariantID, movement.MovementType, movement.Quantity,
		movement.PreviousQuantity, movement.NewQuantity, movement.ReferenceID,
		movement.Notes, movement.PerformedBy, movement.EmployeeID,
	).Scan(&movement.CreatedAt)
}

func (r *StockMovementRepository) GetByShopID(shopID uuid.UUID) ([]*models.StockMovement, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, movement_type, quantity, previous_quantity, new_quantity, reference_id, notes, performed_by, employee_id, created_at
		FROM stock_movements WHERE shop_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []*models.StockMovement
	for rows.Next() {
		movement := &models.StockMovement{}
		err := rows.Scan(
			&movement.ID, &movement.BusinessID, &movement.ShopID, &movement.ProductID,
			&movement.VariantID, &movement.MovementType, &movement.Quantity,
			&movement.PreviousQuantity, &movement.NewQuantity, &movement.ReferenceID,
			&movement.Notes, &movement.PerformedBy, &movement.EmployeeID, &movement.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		movements = append(movements, movement)
	}

	return movements, rows.Err()
}

func (r *StockMovementRepository) GetByShopAndVariant(shopID, variantID uuid.UUID) ([]*models.StockMovement, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, movement_type, quantity, previous_quantity, new_quantity, reference_id, notes, performed_by, employee_id, created_at
		FROM stock_movements WHERE shop_id = $1 AND variant_id = $2
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID, variantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []*models.StockMovement
	for rows.Next() {
		movement := &models.StockMovement{}
		err := rows.Scan(
			&movement.ID, &movement.BusinessID, &movement.ShopID, &movement.ProductID,
			&movement.VariantID, &movement.MovementType, &movement.Quantity,
			&movement.PreviousQuantity, &movement.NewQuantity, &movement.ReferenceID,
			&movement.Notes, &movement.PerformedBy, &movement.EmployeeID, &movement.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		movements = append(movements, movement)
	}

	return movements, rows.Err()
}

func (r *StockMovementRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.StockMovement, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, movement_type, quantity, previous_quantity, new_quantity, reference_id, notes, performed_by, employee_id, created_at
		FROM stock_movements WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []*models.StockMovement
	for rows.Next() {
		movement := &models.StockMovement{}
		err := rows.Scan(
			&movement.ID, &movement.BusinessID, &movement.ShopID, &movement.ProductID,
			&movement.VariantID, &movement.MovementType, &movement.Quantity,
			&movement.PreviousQuantity, &movement.NewQuantity, &movement.ReferenceID,
			&movement.Notes, &movement.PerformedBy, &movement.EmployeeID, &movement.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		movements = append(movements, movement)
	}

	return movements, rows.Err()
}

type StockMovementFilter struct {
	ShopID     *uuid.UUID
	BusinessID *uuid.UUID
	VariantID  *uuid.UUID
	ProductID  *uuid.UUID
	Type       string
	EmployeeID *uuid.UUID
	From       *time.Time
	To         *time.Time
	Page       int
	Limit      int
	Sort       string
}

type StockMovementRow struct {
	*models.StockMovement
	ShopName      string
	ProductName   string
	VariantSKU    string
	VariantAttr   *string
	PerformerName *string
	EmployeeName  *string
	ReferenceType *string
}

func (r *StockMovementRepository) ListFiltered(filter StockMovementFilter) ([]*StockMovementRow, int, error) {
	where := []string{}
	args := []interface{}{}
	argIdx := 1

	if filter.ShopID != nil {
		where = append(where, fmt.Sprintf("sm.shop_id = $%d", argIdx))
		args = append(args, *filter.ShopID)
		argIdx++
	}
	if filter.BusinessID != nil {
		where = append(where, fmt.Sprintf("sm.business_id = $%d", argIdx))
		args = append(args, *filter.BusinessID)
		argIdx++
	}
	if filter.VariantID != nil {
		where = append(where, fmt.Sprintf("sm.variant_id = $%d", argIdx))
		args = append(args, *filter.VariantID)
		argIdx++
	}
	if filter.ProductID != nil {
		where = append(where, fmt.Sprintf("sm.product_id = $%d", argIdx))
		args = append(args, *filter.ProductID)
		argIdx++
	}
	if filter.Type != "" {
		where = append(where, fmt.Sprintf("sm.movement_type::text = $%d", argIdx))
		args = append(args, filter.Type)
		argIdx++
	}
	if filter.EmployeeID != nil {
		where = append(where, fmt.Sprintf("sm.employee_id = $%d", argIdx))
		args = append(args, *filter.EmployeeID)
		argIdx++
	}
	if filter.From != nil {
		where = append(where, fmt.Sprintf("sm.created_at >= $%d", argIdx))
		args = append(args, *filter.From)
		argIdx++
	}
	if filter.To != nil {
		where = append(where, fmt.Sprintf("sm.created_at <= $%d", argIdx))
		args = append(args, *filter.To)
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM stock_movements sm %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	sortDir := "DESC"
	if filter.Sort == "asc" {
		sortDir = "ASC"
	}

	offset := 0
	if filter.Page > 1 {
		offset = (filter.Page - 1) * filter.Limit
	}

	query := fmt.Sprintf(`
		SELECT sm.id, sm.business_id, sm.shop_id, sm.product_id, sm.variant_id,
			sm.movement_type, sm.quantity, sm.previous_quantity, sm.new_quantity,
			sm.reference_id, sm.notes, sm.performed_by, sm.employee_id, sm.created_at,
			s.name AS shop_name,
			p.name AS product_name,
			COALESCE(pv.sku, '') AS variant_sku,
			pv.attributes::text AS variant_attr,
			CASE WHEN u.id IS NOT NULL THEN TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) ELSE '' END AS performer_name,
			CASE WHEN e.id IS NOT NULL THEN TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')) ELSE '' END AS employee_name,
			NULL::text AS reference_type
		FROM stock_movements sm
		JOIN shops s ON s.id = sm.shop_id
		JOIN products p ON p.id = sm.product_id
		LEFT JOIN product_variants pv ON pv.id = sm.variant_id
		LEFT JOIN users u ON u.id = sm.performed_by
		LEFT JOIN employees e ON e.id = sm.employee_id
		%s
		ORDER BY sm.created_at %s
		LIMIT $%d OFFSET $%d
	`, whereClause, sortDir, argIdx, argIdx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*StockMovementRow
	for rows.Next() {
		row := &StockMovementRow{
			StockMovement: &models.StockMovement{},
		}
		err := rows.Scan(
			&row.ID, &row.BusinessID, &row.ShopID, &row.ProductID, &row.VariantID,
			&row.MovementType, &row.Quantity, &row.PreviousQuantity, &row.NewQuantity,
			&row.ReferenceID, &row.Notes, &row.PerformedBy, &row.EmployeeID, &row.CreatedAt,
			&row.ShopName, &row.ProductName, &row.VariantSKU, &row.VariantAttr,
			&row.PerformerName, &row.EmployeeName, &row.ReferenceType,
		)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, row)
	}

	return results, total, rows.Err()
}
