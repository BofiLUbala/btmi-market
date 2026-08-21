package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type ShopRepository struct {
	db *database.DB
}

func NewShopRepository(db *database.DB) *ShopRepository {
	return &ShopRepository{db: db}
}

func (r *ShopRepository) Create(shop *models.Shop) error {
	query := `
		INSERT INTO shops (id, business_id, name, type, city, address, phone, status, supports_shop_delivery, shop_delivery_fee, supports_partner_delivery, partner_delivery_fee, partner_delivery_provider, delivery_city, delivery_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING created_at, updated_at
	`

	shop.ID = uuid.New()
	shop.CreatedAt = time.Now()
	shop.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		shop.ID, shop.BusinessID, shop.Name, shop.Type,
		shop.City, shop.Address, shop.Phone, shop.Status,
		shop.SupportsShopDelivery, shop.ShopDeliveryFee,
		shop.SupportsPartnerDelivery, shop.PartnerDeliveryFee,
		shop.PartnerDeliveryProvider, shop.DeliveryCity, shop.DeliveryAddress,
	).Scan(&shop.CreatedAt, &shop.UpdatedAt)
}

func (r *ShopRepository) GetByID(id uuid.UUID) (*models.Shop, error) {
	query := `
		SELECT id, business_id, name, type, city, address, phone, status, supports_shop_delivery, shop_delivery_fee, supports_partner_delivery, partner_delivery_fee, partner_delivery_provider, delivery_city, delivery_address, created_at, updated_at
		FROM shops WHERE id = $1
	`

	shop := &models.Shop{}
	err := r.db.QueryRow(query, id).Scan(
		&shop.ID, &shop.BusinessID, &shop.Name, &shop.Type,
		&shop.City, &shop.Address, &shop.Phone, &shop.Status,
		&shop.SupportsShopDelivery, &shop.ShopDeliveryFee,
		&shop.SupportsPartnerDelivery, &shop.PartnerDeliveryFee,
		&shop.PartnerDeliveryProvider, &shop.DeliveryCity, &shop.DeliveryAddress,
		&shop.CreatedAt, &shop.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("shop not found")
	}
	if err != nil {
		return nil, err
	}

	return shop, nil
}

func (r *ShopRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.Shop, error) {
	query := `
		SELECT id, business_id, name, type, city, address, phone, status, supports_shop_delivery, shop_delivery_fee, supports_partner_delivery, partner_delivery_fee, partner_delivery_provider, delivery_city, delivery_address, created_at, updated_at
		FROM shops WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shops []*models.Shop
	for rows.Next() {
		shop := &models.Shop{}
		err := rows.Scan(
			&shop.ID, &shop.BusinessID, &shop.Name, &shop.Type,
			&shop.City, &shop.Address, &shop.Phone, &shop.Status,
			&shop.SupportsShopDelivery, &shop.ShopDeliveryFee,
			&shop.SupportsPartnerDelivery, &shop.PartnerDeliveryFee,
			&shop.PartnerDeliveryProvider, &shop.DeliveryCity, &shop.DeliveryAddress,
			&shop.CreatedAt, &shop.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		shops = append(shops, shop)
	}

	return shops, rows.Err()
}

func (r *ShopRepository) Update(shop *models.Shop) error {
	query := `
		UPDATE shops 
		SET name = $2, type = $3, city = $4, address = $5, phone = $6, status = $7,
		    supports_shop_delivery = $8, shop_delivery_fee = $9,
		    supports_partner_delivery = $10, partner_delivery_fee = $11,
		    partner_delivery_provider = $12, delivery_city = $13, delivery_address = $14,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRow(query,
		shop.ID, shop.Name, shop.Type, shop.City,
		shop.Address, shop.Phone, shop.Status,
		shop.SupportsShopDelivery, shop.ShopDeliveryFee,
		shop.SupportsPartnerDelivery, shop.PartnerDeliveryFee,
		shop.PartnerDeliveryProvider, shop.DeliveryCity, shop.DeliveryAddress,
	).Scan(&shop.UpdatedAt)
}
