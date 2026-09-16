package models

import (
	"time"

	"github.com/google/uuid"
)

// A checkout group is one buyer's single trip through checkout.
//
// An order still belongs to exactly one shop. That is not an accident to be
// worked around: it is what makes a seller's order list, the inventory
// reservation, the commission row and the courier assignment unambiguous. So a
// cart holding two shops' products produces two orders, and the group is the
// object that says they came from the same cart, the same address and the same
// payment decision.
//
// Money is never pooled at the group. Each child order carries its own payment
// row with its own amounts, so "how much belongs to Shop A" has exactly one
// answer and Finance's per-shop and per-product totals reconcile with the
// platform total by construction.
type CheckoutGroup struct {
	ID             uuid.UUID `json:"id" db:"id"`
	BuyerProfileID uuid.UUID `json:"buyer_profile_id" db:"buyer_profile_id"`
	Currency       string    `json:"currency" db:"currency"`
	ShopCount      int       `json:"shop_count" db:"shop_count"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// CartLineInput is one line of the buyer's cart. It carries shop_id because the
// cart spans shops: without it the server would have to guess which shop a
// variant was being bought from, which is exactly the bug that made a second
// shop's product unaddable.
type CartLineInput struct {
	ProductID string `json:"product_id" binding:"required"`
	VariantID string `json:"variant_id" binding:"required"`
	ShopID    string `json:"shop_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type CartPreviewRequest struct {
	Items     []CartLineInput `json:"items" binding:"required,min=1"`
	UsePoints bool            `json:"use_points"`
}

type CheckoutCreateRequest struct {
	Items          []CartLineInput `json:"items" binding:"required,min=1"`
	UsePoints      bool            `json:"use_points"`
	IdempotencyKey *string         `json:"idempotency_key"`
}

// CartLineIssue is a problem with one specific line. Lines are reported
// individually and by product/variant so the buyer is told "this size of this
// product is out of stock" rather than having the whole cart rejected with one
// opaque message.
type CartLineIssue struct {
	ProductID   string `json:"product_id"`
	VariantID   string `json:"variant_id"`
	ShopID      string `json:"shop_id"`
	ProductName string `json:"product_name,omitempty"`
	VariantName string `json:"variant_name,omitempty"`
	Code        string `json:"code"`
	Message     string `json:"message"`
	Available   int    `json:"available"`
	Requested   int    `json:"requested"`
}

type CartShopGroup struct {
	ShopID    uuid.UUID `json:"shop_id"`
	ShopName  string    `json:"shop_name"`
	Currency  string    `json:"currency"`
	Subtotal  float64   `json:"subtotal"`
	ItemCount int       `json:"item_count"`
	// Nil until the group is actually checked out.
	OrderID     *uuid.UUID      `json:"order_id,omitempty"`
	OrderNumber string          `json:"order_number,omitempty"`
	Lines       []CartLineInput `json:"lines"`
}

// CartPreviewResponse is the authoritative shape of the cart: what it costs, how
// it splits by shop, and everything wrong with it. Issues never empty the cart -
// the buyer keeps every good line and fixes the named one.
type CartPreviewResponse struct {
	Currency     string          `json:"currency"`
	Subtotal     float64         `json:"subtotal"`
	ItemCount    int             `json:"item_count"`
	ShopCount    int             `json:"shop_count"`
	Shops        []CartShopGroup `json:"shops"`
	Issues       []CartLineIssue `json:"issues"`
	Checkoutable bool            `json:"checkoutable"`
	// Points are held by the buyer, not by a shop, so they are previewed once
	// across the whole cart rather than per child order.
	AvailablePoints      int     `json:"available_points"`
	PointsDiscountAmount float64 `json:"points_discount_amount"`
	FinalTotal           float64 `json:"final_total"`
}

type CheckoutCreateResponse struct {
	CheckoutGroupID uuid.UUID       `json:"checkout_group_id"`
	Currency        string          `json:"currency"`
	Subtotal        float64         `json:"subtotal"`
	ShopCount       int             `json:"shop_count"`
	Shops           []CartShopGroup `json:"shops"`
	OrderIDs        []uuid.UUID     `json:"order_ids"`
}
