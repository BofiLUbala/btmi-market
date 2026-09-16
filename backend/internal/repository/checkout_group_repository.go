package repository

import (
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// CheckoutGroupRepository ties the orders produced by one trip through checkout
// together. It deliberately stores no money: every amount lives on the child
// order and its payment, so there is never a group total that could disagree
// with the sum of its parts.
type CheckoutGroupRepository struct {
	db *database.DB
}

func NewCheckoutGroupRepository(db *database.DB) *CheckoutGroupRepository {
	return &CheckoutGroupRepository{db: db}
}

func (r *CheckoutGroupRepository) Create(g *models.CheckoutGroup) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	if g.Currency == "" {
		g.Currency = models.CurrencyUSD
	}
	return r.db.QueryRow(`
		INSERT INTO checkout_groups (id, buyer_profile_id, currency, shop_count)
		VALUES ($1,$2,$3,$4)
		RETURNING created_at, updated_at`,
		g.ID, g.BuyerProfileID, g.Currency, g.ShopCount,
	).Scan(&g.CreatedAt, &g.UpdatedAt)
}

// AttachOrder records that an order came out of this checkout.
func (r *CheckoutGroupRepository) AttachOrder(groupID, orderID uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE orders SET checkout_group_id=$1 WHERE id=$2`, groupID, orderID)
	return err
}

// ListOrderIDs returns the sibling orders of a checkout, oldest first. This is
// what lets the buyer be shown one checkout experience over several orders.
func (r *CheckoutGroupRepository) ListOrderIDs(groupID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(`SELECT id FROM orders WHERE checkout_group_id=$1 ORDER BY created_at`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// GetGroupIDForOrder returns the checkout an order belongs to, or nil when it
// was placed on its own.
func (r *CheckoutGroupRepository) GetGroupIDForOrder(orderID uuid.UUID) (*uuid.UUID, error) {
	var groupID *uuid.UUID
	if err := r.db.QueryRow(`SELECT checkout_group_id FROM orders WHERE id=$1`, orderID).Scan(&groupID); err != nil {
		return nil, err
	}
	return groupID, nil
}
