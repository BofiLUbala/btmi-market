package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type InventoryRepository struct {
	db *database.DB
}

func NewInventoryRepository(db *database.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
}

func (r *InventoryRepository) CreateOrUpdate(inventory *models.Inventory) error {
	query := `
		INSERT INTO inventory (id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (shop_id, variant_id) 
		DO UPDATE SET quantity = inventory.quantity + $6, updated_at = NOW()
		RETURNING id, created_at, updated_at
	`

	if inventory.ID == uuid.Nil {
		inventory.ID = uuid.New()
	}
	inventory.CreatedAt = time.Now()
	inventory.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		inventory.ID, inventory.BusinessID, inventory.ShopID,
		inventory.ProductID, inventory.VariantID, inventory.Quantity, inventory.ReservedQuantity,
	).Scan(&inventory.ID, &inventory.CreatedAt, &inventory.UpdatedAt)
}

func (r *InventoryRepository) GetByShopAndVariant(shopID, variantID uuid.UUID) (*models.Inventory, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
		FROM inventory WHERE shop_id = $1 AND variant_id = $2
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("inventory not found")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (r *InventoryRepository) GetByShopID(shopID uuid.UUID) ([]*models.Inventory, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
		FROM inventory WHERE shop_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*models.Inventory
	for rows.Next() {
		inventory := &models.Inventory{}
		err := rows.Scan(
			&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
			&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
			&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		inventories = append(inventories, inventory)
	}

	return inventories, rows.Err()
}

func (r *InventoryRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.Inventory, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
		FROM inventory WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*models.Inventory
	for rows.Next() {
		inventory := &models.Inventory{}
		err := rows.Scan(
			&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
			&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
			&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		inventories = append(inventories, inventory)
	}

	return inventories, rows.Err()
}

func (r *InventoryRepository) GetByVariantID(variantID uuid.UUID) ([]*models.Inventory, error) {
	query := `
		SELECT id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
		FROM inventory WHERE variant_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, variantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []*models.Inventory
	for rows.Next() {
		inventory := &models.Inventory{}
		err := rows.Scan(
			&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
			&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
			&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		inventories = append(inventories, inventory)
	}

	return inventories, rows.Err()
}

func (r *InventoryRepository) UpdateQuantity(shopID, variantID uuid.UUID, quantityChange int) (*models.Inventory, error) {
	query := `
		UPDATE inventory 
		SET quantity = quantity + $3, updated_at = NOW()
		WHERE shop_id = $1 AND variant_id = $2
		RETURNING id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID, quantityChange).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("inventory not found")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (r *InventoryRepository) UpdateQuantityAtomic(shopID, variantID uuid.UUID, quantityChange int, minQuantity int) (*models.Inventory, error) {
	query := `
		UPDATE inventory 
		SET quantity = quantity + $4, updated_at = NOW()
		WHERE shop_id = $1 AND variant_id = $2 AND quantity >= $3
		RETURNING id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID, minQuantity, quantityChange).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient_stock")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (r *InventoryRepository) ReserveAtomic(shopID, variantID uuid.UUID, quantity int) (*models.Inventory, error) {
	query := `
		UPDATE inventory 
		SET reserved_quantity = reserved_quantity + $3, updated_at = NOW()
		WHERE shop_id = $1 AND variant_id = $2 AND (quantity - reserved_quantity) >= $3
		RETURNING id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID, quantity).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient_stock")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (r *InventoryRepository) ReleaseAtomic(shopID, variantID uuid.UUID, quantity int) (*models.Inventory, error) {
	query := `
		UPDATE inventory 
		SET reserved_quantity = reserved_quantity - $3, updated_at = NOW()
		WHERE shop_id = $1 AND variant_id = $2 AND reserved_quantity >= $3
		RETURNING id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID, quantity).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient_reserved")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (r *InventoryRepository) ClaimReservedAtomic(shopID, variantID uuid.UUID, quantity int) (*models.Inventory, error) {
	query := `
		UPDATE inventory 
		SET quantity = quantity - $3, reserved_quantity = reserved_quantity - $3, updated_at = NOW()
		WHERE shop_id = $1 AND variant_id = $2 AND reserved_quantity >= $3
		RETURNING id, business_id, shop_id, product_id, variant_id, quantity, reserved_quantity, created_at, updated_at
	`

	inventory := &models.Inventory{}
	err := r.db.QueryRow(query, shopID, variantID, quantity).Scan(
		&inventory.ID, &inventory.BusinessID, &inventory.ShopID,
		&inventory.ProductID, &inventory.VariantID, &inventory.Quantity,
		&inventory.ReservedQuantity, &inventory.CreatedAt, &inventory.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient_reserved")
	}
	if err != nil {
		return nil, err
	}

	return inventory, nil
}
