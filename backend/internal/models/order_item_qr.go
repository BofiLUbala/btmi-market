package models

import (
	"time"

	"github.com/google/uuid"
)

// QRRole is the authenticated actor a resolved ORDER_ITEM QR is shown to. The same
// physical QR resolves to the same underlying order, but the fields each role may
// see differ (see ResolveOrderItemQR in the service layer).
type QRRole string

const (
	QRRoleBuyer   QRRole = "BUYER"
	QRRoleSeller  QRRole = "SELLER"
	QRRoleCourier QRRole = "COURIER"
	QRRoleAdmin   QRRole = "ADMIN"
)

// OrderItemQR is the QR identity of one specific ordered item. The printed code is
// only the signed opaque token tbk.oi.<public_reference>.<signature>; every visible
// field here except the token itself is metadata read from the order tables at
// resolution time, never encoded in the QR.
type OrderItemQR struct {
	Reference   string    `json:"reference"` // OI-XXXXXXXX
	Token       string    `json:"token,omitempty"`
	OrderID     uuid.UUID `json:"order_id"`
	OrderItemID uuid.UUID `json:"order_item_id"`
	ProductID   uuid.UUID `json:"product_id"`
	VariantID   uuid.UUID `json:"variant_id"`
	Status      string    `json:"status"`
	LabelURL    string    `json:"label_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// OrderItemQRBase is the identity block embedded in every resolution. It is
// deliberately free of any data beyond the reference itself.
type OrderItemQRBase struct {
	Reference   string    `json:"reference"`
	OrderID     uuid.UUID `json:"order_id"`
	OrderItemID uuid.UUID `json:"order_item_id"`
	Status      string    `json:"status"`
}

// OrderItemQRProduct is the immutable product/variant snapshot stored on the order
// line. It never reads the current catalogue, so a product repriced or deleted
// after the sale does not change what the QR reports.
type OrderItemQRProduct struct {
	ProductID     uuid.UUID `json:"product_id"`
	ProductNumber string    `json:"product_number,omitempty"`
	ProductName   string    `json:"product_name"`
	ProductImage  string    `json:"product_image,omitempty"`
	ProductSKU    string    `json:"product_sku,omitempty"`
	VariantID     uuid.UUID `json:"variant_id"`
	VariantName   string    `json:"variant_name"`
	VariantSKU    string    `json:"variant_sku,omitempty"`
	// Size and Color are read from the order line's attribute snapshot when the
	// attributes use those exact keys; the full snapshot is always in Attributes.
	Size       string  `json:"size,omitempty"`
	Color      string  `json:"color,omitempty"`
	Attributes JSONMap `json:"attributes,omitempty"`
	Quantity   int     `json:"quantity"`
}

// OrderItemQRShop is the shop and seller context of the order.
type OrderItemQRShop struct {
	ShopID        uuid.UUID `json:"shop_id"`
	ShopName      string    `json:"shop_name"`
	ShopReference string    `json:"shop_reference,omitempty"`
	BusinessID    uuid.UUID `json:"business_id"`
	SellerName    string    `json:"seller_name,omitempty"`
}

// OrderItemQROrder is the order-level context of the scanned item.
type OrderItemQROrder struct {
	OrderID        uuid.UUID `json:"order_id"`
	OrderNumber    string    `json:"order_number"`
	OrderItemID    uuid.UUID `json:"order_item_id"`
	OrderDate      time.Time `json:"order_date"`
	OrderStatus    string    `json:"order_status"`
	DeliveryStatus string    `json:"delivery_status,omitempty"`
	DeliveryMethod string    `json:"delivery_method,omitempty"`
	PaymentMethod  string    `json:"payment_method,omitempty"`
	PaymentStatus  string    `json:"payment_status,omitempty"`
	PaymentTiming  string    `json:"payment_timing,omitempty"`
}

// OrderItemQRPrice is the immutable pricing snapshot attached to this order item.
// Every amount comes from the order/order-line/payment snapshot, never from the
// current catalogue price. Fields the resolver prunes for a role are zeroed.
type OrderItemQRPrice struct {
	UnitPrice         float64 `json:"unit_price"`
	Quantity          int     `json:"quantity"`
	Subtotal          float64 `json:"subtotal"`        // unit_price * quantity
	Discount          float64 `json:"discount"`        // promotion discount on this item
	PointsDiscount    float64 `json:"points_discount"` // points applied on this item
	ItemTotal         float64 `json:"item_total"`      // what this item is really charged
	DeliveryFee       float64 `json:"delivery_fee"`    // order delivery fee snapshot
	PaymentMarkup     float64 `json:"payment_markup,omitempty"`
	PaymentMarkupType string  `json:"payment_markup_type,omitempty"`
	// AmountToCollect is the courier's cash-on-delivery figure: what the courier
	// must collect at the door, or 0 when the order was prepaid.
	AmountToCollect float64 `json:"amount_to_collect,omitempty"`
	FinalAmount     float64 `json:"final_amount"` // order-level total the buyer pays
	Currency        string  `json:"currency"`
}

// OrderItemQRBuyer is the buyer block. Phone and Email are only ever returned to
// the buyer's own role or to an admin; a seller sees the identity fields and a
// courier the delivery recipient fields, never the contact details.
type OrderItemQRBuyer struct {
	BuyerProfileID uuid.UUID `json:"buyer_profile_id"`
	BuyerReference string    `json:"buyer_reference,omitempty"`
	FirstName      string    `json:"first_name,omitempty"`
	LastName       string    `json:"last_name,omitempty"`
	DisplayName    string    `json:"display_name,omitempty"`
	Phone          string    `json:"phone,omitempty"`
	Email          string    `json:"email,omitempty"`
}

// OrderItemQRAddress is the immutable delivery-address snapshot saved on the order
// when the buyer placed it. It never reads the buyer's current profile address.
type OrderItemQRAddress struct {
	RecipientName        string `json:"recipient_name,omitempty"`
	RecipientPhone       string `json:"recipient_phone,omitempty"`
	Province             string `json:"province,omitempty"`
	City                 string `json:"city,omitempty"`
	Commune              string `json:"commune,omitempty"`
	Street               string `json:"street,omitempty"`
	BuildingNumber       string `json:"building_number,omitempty"`
	Landmark             string `json:"landmark,omitempty"`
	DeliveryInstructions string `json:"delivery_instructions,omitempty"`
}

// OrderItemQRResolved is what scanning an ORDER_ITEM QR returns after the token is
// validated, the caller authenticated and the role permissions applied.
type OrderItemQRResolved struct {
	QR              OrderItemQRBase     `json:"qr"`
	Role            QRRole              `json:"role"`
	Product         OrderItemQRProduct  `json:"product"`
	Shop            OrderItemQRShop     `json:"shop"`
	Order           OrderItemQROrder    `json:"order"`
	Price           OrderItemQRPrice    `json:"price"`
	Buyer           *OrderItemQRBuyer   `json:"buyer,omitempty"`
	DeliveryAddress *OrderItemQRAddress `json:"delivery_address,omitempty"`
}
