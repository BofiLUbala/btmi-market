package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type PointAccountRepository struct {
	db *database.DB
}

func NewPointAccountRepository(db *database.DB) *PointAccountRepository {
	return &PointAccountRepository{db: db}
}

func (r *PointAccountRepository) CreateOrUpdate(account *models.PointAccount) error {
	query := `
		INSERT INTO point_accounts (id, owner_type, owner_id, current_points, lifetime_points, level_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (owner_type, owner_id) DO UPDATE SET
			current_points = EXCLUDED.current_points,
			lifetime_points = EXCLUDED.lifetime_points,
			level_id = EXCLUDED.level_id,
			status = EXCLUDED.status,
			updated_at = NOW()
		RETURNING created_at, updated_at
	`
	if account.ID == uuid.Nil {
		account.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		account.ID, account.OwnerType, account.OwnerID,
		account.CurrentPoints, account.LifetimePoints,
		account.LevelID, account.Status,
	).Scan(&account.CreatedAt, &account.UpdatedAt)
}

func (r *PointAccountRepository) GetByOwner(ownerType models.PointOwnerType, ownerID uuid.UUID) (*models.PointAccount, error) {
	query := `
		SELECT id, owner_type, owner_id, current_points, lifetime_points, reserved_points, level_id, status, created_at, updated_at
		FROM point_accounts WHERE owner_type = $1 AND owner_id = $2
	`
	a := &models.PointAccount{}
	err := r.db.QueryRow(query, ownerType, ownerID).Scan(
		&a.ID, &a.OwnerType, &a.OwnerID, &a.CurrentPoints, &a.LifetimePoints,
		&a.ReservedPoints, &a.LevelID, &a.Status, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *PointAccountRepository) UpdatePoints(accountID uuid.UUID, currentPoints, lifetimePoints int, reservedPoints int) error {
	query := `UPDATE point_accounts SET current_points=$1, lifetime_points=$2, reserved_points=$3, updated_at=NOW() WHERE id=$4`
	_, err := r.db.Exec(query, currentPoints, lifetimePoints, reservedPoints, accountID)
	return err
}

func (r *PointAccountRepository) UpdateLevel(accountID uuid.UUID, levelID uuid.UUID) error {
	query := `UPDATE point_accounts SET level_id=$1, updated_at=NOW() WHERE id=$2`
	_, err := r.db.Exec(query, levelID, accountID)
	return err
}

type PointTransactionRepository struct {
	db *database.DB
}

func NewPointTransactionRepository(db *database.DB) *PointTransactionRepository {
	return &PointTransactionRepository{db: db}
}

func (r *PointTransactionRepository) Create(txn *models.PointTransaction) error {
	query := `
		INSERT INTO point_transactions (id, point_account_id, reference_type, reference_id, type, points_change, previous_points, new_points)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at
	`
	if txn.ID == uuid.Nil {
		txn.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		txn.ID, txn.PointAccountID, txn.ReferenceType, txn.ReferenceID,
		txn.Type, txn.PointsChange, txn.PreviousPoints, txn.NewPoints,
	).Scan(&txn.CreatedAt)
}

func (r *PointTransactionRepository) GetByAccountID(accountID uuid.UUID, limit, offset int) ([]*models.PointTransaction, error) {
	query := `
		SELECT id, point_account_id, reference_type, reference_id, type, points_change, previous_points, new_points, created_at
		FROM point_transactions WHERE point_account_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, accountID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txns []*models.PointTransaction
	for rows.Next() {
		t := &models.PointTransaction{}
		if err := rows.Scan(
			&t.ID, &t.PointAccountID, &t.ReferenceType, &t.ReferenceID,
			&t.Type, &t.PointsChange, &t.PreviousPoints, &t.NewPoints, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		txns = append(txns, t)
	}
	return txns, rows.Err()
}

func (r *PointTransactionRepository) ExistsByReference(pointAccountID uuid.UUID, referenceType string, referenceID uuid.UUID, txnType string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM point_transactions WHERE point_account_id=$1 AND reference_type=$2 AND reference_id=$3 AND type=$4)`
	err := r.db.QueryRow(query, pointAccountID, referenceType, referenceID, txnType).Scan(&exists)
	return exists, err
}

func (r *PointAccountRepository) ReserveAtomic(accountID uuid.UUID, pointsToReserve int) (*models.PointAccount, error) {
	query := `
		UPDATE point_accounts
		SET reserved_points = reserved_points + $2, updated_at = NOW()
		WHERE id = $1 AND (current_points - reserved_points) >= $2
		RETURNING id, owner_type, owner_id, current_points, lifetime_points, reserved_points, level_id, status, created_at, updated_at
	`
	a := &models.PointAccount{}
	err := r.db.QueryRow(query, accountID, pointsToReserve).Scan(
		&a.ID, &a.OwnerType, &a.OwnerID, &a.CurrentPoints, &a.LifetimePoints,
		&a.ReservedPoints, &a.LevelID, &a.Status, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *PointAccountRepository) ReleaseAtomic(accountID uuid.UUID, pointsToRelease int) (*models.PointAccount, error) {
	query := `
		UPDATE point_accounts
		SET reserved_points = reserved_points - $2, updated_at = NOW()
		WHERE id = $1 AND reserved_points >= $2
		RETURNING id, owner_type, owner_id, current_points, lifetime_points, reserved_points, level_id, status, created_at, updated_at
	`
	a := &models.PointAccount{}
	err := r.db.QueryRow(query, accountID, pointsToRelease).Scan(
		&a.ID, &a.OwnerType, &a.OwnerID, &a.CurrentPoints, &a.LifetimePoints,
		&a.ReservedPoints, &a.LevelID, &a.Status, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *PointAccountRepository) ConsumeAtomic(accountID uuid.UUID, pointsToConsume int) (*models.PointAccount, error) {
	query := `
		UPDATE point_accounts
		SET reserved_points = reserved_points - $2, current_points = current_points - $2, updated_at = NOW()
		WHERE id = $1 AND reserved_points >= $2 AND current_points >= $2
		RETURNING id, owner_type, owner_id, current_points, lifetime_points, reserved_points, level_id, status, created_at, updated_at
	`
	a := &models.PointAccount{}
	err := r.db.QueryRow(query, accountID, pointsToConsume).Scan(
		&a.ID, &a.OwnerType, &a.OwnerID, &a.CurrentPoints, &a.LifetimePoints,
		&a.ReservedPoints, &a.LevelID, &a.Status, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}
