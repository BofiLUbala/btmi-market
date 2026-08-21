package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type EmployeeRepository struct {
	db *database.DB
}

func NewEmployeeRepository(db *database.DB) *EmployeeRepository {
	return &EmployeeRepository{db: db}
}

func (r *EmployeeRepository) Create(employee *models.Employee) error {
	query := `
		INSERT INTO employees (id, business_id, linked_user_id, first_name, middle_name, last_name, phone, email, job_title, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at
	`

	employee.ID = uuid.New()
	employee.CreatedAt = time.Now()
	employee.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		employee.ID, employee.BusinessID, employee.LinkedUserID,
		employee.FirstName, employee.MiddleName, employee.LastName,
		employee.Phone, employee.Email, employee.JobTitle, employee.Status,
	).Scan(&employee.CreatedAt, &employee.UpdatedAt)
}

func (r *EmployeeRepository) GetByID(id uuid.UUID) (*models.Employee, error) {
	query := `
		SELECT id, business_id, linked_user_id, first_name, middle_name, last_name, phone, email, job_title, status, created_at, updated_at
		FROM employees WHERE id = $1
	`

	employee := &models.Employee{}
	err := r.db.QueryRow(query, id).Scan(
		&employee.ID, &employee.BusinessID, &employee.LinkedUserID,
		&employee.FirstName, &employee.MiddleName, &employee.LastName,
		&employee.Phone, &employee.Email, &employee.JobTitle, &employee.Status,
		&employee.CreatedAt, &employee.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("employee not found")
	}
	if err != nil {
		return nil, err
	}

	return employee, nil
}

func (r *EmployeeRepository) GetByLinkedUserID(userID uuid.UUID) (*models.Employee, error) {
	query := `
		SELECT id, business_id, linked_user_id, first_name, middle_name, last_name, phone, email, job_title, status, created_at, updated_at
		FROM employees WHERE linked_user_id = $1 AND status = 'ACTIVE'
	`

	employee := &models.Employee{}
	err := r.db.QueryRow(query, userID).Scan(
		&employee.ID, &employee.BusinessID, &employee.LinkedUserID,
		&employee.FirstName, &employee.MiddleName, &employee.LastName,
		&employee.Phone, &employee.Email, &employee.JobTitle, &employee.Status,
		&employee.CreatedAt, &employee.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("employee not found")
	}
	if err != nil {
		return nil, err
	}

	return employee, nil
}

func (r *EmployeeRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.Employee, error) {
	query := `
		SELECT id, business_id, linked_user_id, first_name, middle_name, last_name, phone, email, job_title, status, created_at, updated_at
		FROM employees WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []*models.Employee
	for rows.Next() {
		employee := &models.Employee{}
		err := rows.Scan(
			&employee.ID, &employee.BusinessID, &employee.LinkedUserID,
			&employee.FirstName, &employee.MiddleName, &employee.LastName,
			&employee.Phone, &employee.Email, &employee.JobTitle, &employee.Status,
			&employee.CreatedAt, &employee.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		employees = append(employees, employee)
	}

	return employees, rows.Err()
}

func (r *EmployeeRepository) Update(employee *models.Employee) error {
	query := `
		UPDATE employees 
		SET first_name = $2, middle_name = $3, last_name = $4, phone = $5, email = $6, job_title = $7, status = $8, linked_user_id = $9, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRow(query,
		employee.ID, employee.FirstName, employee.MiddleName, employee.LastName,
		employee.Phone, employee.Email, employee.JobTitle, employee.Status, employee.LinkedUserID,
	).Scan(&employee.UpdatedAt)
}
