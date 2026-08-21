package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type AssignmentRepository struct {
	db *database.DB
}

func NewAssignmentRepository(db *database.DB) *AssignmentRepository {
	return &AssignmentRepository{db: db}
}

func (r *AssignmentRepository) Create(assignment *models.EmployeeShopAssignment) error {
	query := `
		INSERT INTO employee_shop_assignments (id, employee_id, shop_id, assigned_by, status, assigned_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`

	assignment.ID = uuid.New()
	assignment.AssignedAt = time.Now()
	assignment.CreatedAt = time.Now()
	assignment.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		assignment.ID, assignment.EmployeeID, assignment.ShopID,
		assignment.AssignedBy, assignment.Status, assignment.AssignedAt,
	).Scan(&assignment.CreatedAt, &assignment.UpdatedAt)
}

func (r *AssignmentRepository) GetByID(id uuid.UUID) (*models.EmployeeShopAssignment, error) {
	query := `
		SELECT id, employee_id, shop_id, assigned_by, status, assigned_at, created_at, updated_at
		FROM employee_shop_assignments WHERE id = $1
	`

	assignment := &models.EmployeeShopAssignment{}
	err := r.db.QueryRow(query, id).Scan(
		&assignment.ID, &assignment.EmployeeID, &assignment.ShopID,
		&assignment.AssignedBy, &assignment.Status, &assignment.AssignedAt,
		&assignment.CreatedAt, &assignment.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("assignment not found")
	}
	if err != nil {
		return nil, err
	}

	return assignment, nil
}

func (r *AssignmentRepository) GetByEmployeeAndShop(employeeID, shopID uuid.UUID) (*models.EmployeeShopAssignment, error) {
	query := `
		SELECT id, employee_id, shop_id, assigned_by, status, assigned_at, created_at, updated_at
		FROM employee_shop_assignments 
		WHERE employee_id = $1 AND shop_id = $2 AND status = 'ACTIVE'
	`

	assignment := &models.EmployeeShopAssignment{}
	err := r.db.QueryRow(query, employeeID, shopID).Scan(
		&assignment.ID, &assignment.EmployeeID, &assignment.ShopID,
		&assignment.AssignedBy, &assignment.Status, &assignment.AssignedAt,
		&assignment.CreatedAt, &assignment.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("assignment not found")
	}
	if err != nil {
		return nil, err
	}

	return assignment, nil
}

func (r *AssignmentRepository) GetByShopID(shopID uuid.UUID) ([]*models.EmployeeShopAssignment, error) {
	query := `
		SELECT id, employee_id, shop_id, assigned_by, status, assigned_at, created_at, updated_at
		FROM employee_shop_assignments 
		WHERE shop_id = $1 AND status = 'ACTIVE'
		ORDER BY assigned_at DESC
	`

	rows, err := r.db.Query(query, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []*models.EmployeeShopAssignment
	for rows.Next() {
		assignment := &models.EmployeeShopAssignment{}
		err := rows.Scan(
			&assignment.ID, &assignment.EmployeeID, &assignment.ShopID,
			&assignment.AssignedBy, &assignment.Status, &assignment.AssignedAt,
			&assignment.CreatedAt, &assignment.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, assignment)
	}

	return assignments, rows.Err()
}

func (r *AssignmentRepository) GetByEmployeeID(employeeID uuid.UUID) ([]*models.EmployeeShopAssignment, error) {
	query := `
		SELECT id, employee_id, shop_id, assigned_by, status, assigned_at, created_at, updated_at
		FROM employee_shop_assignments 
		WHERE employee_id = $1 AND status = 'ACTIVE'
		ORDER BY assigned_at DESC
	`

	rows, err := r.db.Query(query, employeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []*models.EmployeeShopAssignment
	for rows.Next() {
		assignment := &models.EmployeeShopAssignment{}
		err := rows.Scan(
			&assignment.ID, &assignment.EmployeeID, &assignment.ShopID,
			&assignment.AssignedBy, &assignment.Status, &assignment.AssignedAt,
			&assignment.CreatedAt, &assignment.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, assignment)
	}

	return assignments, rows.Err()
}

func (r *AssignmentRepository) RemoveAssignment(employeeID, shopID uuid.UUID) error {
	query := `
		UPDATE employee_shop_assignments 
		SET status = 'INACTIVE', updated_at = NOW()
		WHERE employee_id = $1 AND shop_id = $2 AND status = 'ACTIVE'
	`

	result, err := r.db.Exec(query, employeeID, shopID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("assignment not found")
	}

	return nil
}
