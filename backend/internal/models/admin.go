package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type AdminRole string

const (
	AdminRoleSuperAdmin          AdminRole = "SUPER_ADMIN"
	AdminRoleDirectionAdmin      AdminRole = "DIRECTION_ADMIN"
	AdminRoleCommerceAdmin       AdminRole = "COMMERCE_ADMIN"
	AdminRoleFinanceSupportAdmin AdminRole = "FINANCE_SUPPORT_ADMIN"
	AdminRoleTechnicalAdmin      AdminRole = "TECHNICAL_ADMIN"
)

type AdminStatus string

const (
	AdminStatusActive      AdminStatus = "ACTIVE"
	AdminStatusSuspended   AdminStatus = "SUSPENDED"
	AdminStatusDeactivated AdminStatus = "DEACTIVATED"
)

type AdminUser struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	FirstName   string      `json:"first_name" db:"first_name"`
	LastName    string      `json:"last_name" db:"last_name"`
	Email       string      `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	Role        AdminRole   `json:"role" db:"role"`
	Status      AdminStatus `json:"status" db:"status"`
	MFAEnabled  bool        `json:"mfa_enabled" db:"mfa_enabled"`
	LastLoginAt *time.Time  `json:"last_login_at" db:"last_login_at"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type AdminRefreshToken struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	AdminID   uuid.UUID  `json:"admin_id" db:"admin_id"`
	TokenHash string     `json:"token_hash" db:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at" db:"revoked_at"`
	IPAddress *string    `json:"ip_address" db:"ip_address"`
	UserAgent *string    `json:"user_agent" db:"user_agent"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

type AdminClaims struct {
	AdminID uuid.UUID `json:"sub"`
	Email   string    `json:"email"`
	Role    AdminRole `json:"role"`
	jwt.RegisteredClaims
}

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AdminLoginResponse struct {
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	TokenType    string     `json:"token_type"`
	ExpiresIn    int        `json:"expires_in"`
	Admin        *AdminUser `json:"admin"`
}

type DirectionOverviewStats struct {
	TotalUsers         int     `json:"total_users"`
	TotalBuyers        int     `json:"total_buyers"`
	TotalSellers       int     `json:"total_sellers"`
	TotalEmployees     int     `json:"total_employees"`
	TotalBusinesses    int     `json:"total_businesses"`
	TotalShops         int     `json:"total_shops"`
	ActiveShops        int     `json:"active_shops"`
	TotalProducts      int     `json:"total_products"`
	PublishedProducts  int     `json:"published_products"`
	OutOfStockProducts int     `json:"out_of_stock_products"`
	TotalOrders        int     `json:"total_orders"`
	OrdersToday        int     `json:"orders_today"`
	CompletedOrders    int     `json:"completed_orders"`
	PendingOrders      int     `json:"pending_orders"`
	ConfirmedCash      float64 `json:"confirmed_cash"`
	OpenDisputes       int     `json:"open_disputes"`
	CriticalAlerts     int     `json:"critical_alerts"`
	PlatformHealth     string  `json:"platform_health"`
}

type AdminUserListItem struct {
	ID            uuid.UUID   `json:"id"`
	FirstName     string      `json:"first_name"`
	MiddleName    string      `json:"middle_name"`
	LastName      string      `json:"last_name"`
	Phone         string      `json:"phone"`
	Email         string      `json:"email"`
	Status        UserStatus  `json:"status"`
	EmailVerified bool        `json:"email_verified"`
	AccountType   AccountType `json:"account_type"`
	CreatedAt     time.Time   `json:"created_at"`
	BusinessCount int         `json:"business_count"`
	ShopCount     int         `json:"shop_count"`
	OrderCount    int         `json:"order_count"`
	TotalPoints   int         `json:"total_points"`
}

type UserStatusChangeRequest struct {
	Reason string `json:"reason" binding:"required,min=5"`
}
