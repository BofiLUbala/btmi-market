package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type AdminDirectionService struct {
	db               *database.DB
	userRepo         *repository.UserRepository
	refreshTokenRepo *repository.RefreshTokenRepository
	auditService     *AuditService
}

func NewAdminDirectionService(
	db *database.DB,
	userRepo *repository.UserRepository,
	refreshTokenRepo *repository.RefreshTokenRepository,
	auditService *AuditService,
) *AdminDirectionService {
	return &AdminDirectionService{
		db:               db,
		userRepo:         userRepo,
		refreshTokenRepo: refreshTokenRepo,
		auditService:     auditService,
	}
}

func (s *AdminDirectionService) GetOverviewStats(ctx context.Context) (*models.DirectionOverviewStats, error) {
	stats := &models.DirectionOverviewStats{
		PlatformHealth: "HEALTHY",
	}

	// 1. User counts
	userQuery := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE account_type = 'BUYER'),
			COUNT(*) FILTER (WHERE account_type = 'SELLER'),
			COUNT(*) FILTER (WHERE account_type = 'EMPLOYEE')
		FROM users
	`
	_ = s.db.QueryRowContext(ctx, userQuery).Scan(
		&stats.TotalUsers,
		&stats.TotalBuyers,
		&stats.TotalSellers,
		&stats.TotalEmployees,
	)

	// 2. Businesses & Shops
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM businesses`).Scan(&stats.TotalBusinesses)
	_ = s.db.QueryRowContext(ctx, `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'ACTIVE')
		FROM shops
	`).Scan(&stats.TotalShops, &stats.ActiveShops)

	// 3. Products
	_ = s.db.QueryRowContext(ctx, `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE publication_status = 'PUBLISHED')
		FROM products
	`).Scan(&stats.TotalProducts, &stats.PublishedProducts)

	// Out of stock products: products where all variants have sum(available) <= 0
	_ = s.db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT p.id)
		FROM products p
		JOIN inventory inv ON p.id = inv.product_id
		GROUP BY p.id
		HAVING SUM(inv.quantity - inv.reserved_quantity) <= 0
	`).Scan(&stats.OutOfStockProducts)

	// 4. Orders
	orderQuery := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
			COUNT(*) FILTER (WHERE status = 'COMPLETED'),
			COUNT(*) FILTER (WHERE status = 'PENDING')
		FROM orders
	`
	_ = s.db.QueryRowContext(ctx, orderQuery).Scan(
		&stats.TotalOrders,
		&stats.OrdersToday,
		&stats.CompletedOrders,
		&stats.PendingOrders,
	)

	// 5. Confirmed Cash
	var cashTotal sql.NullFloat64
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM buyer_payments
		WHERE status = 'VERIFIED' OR seller_confirmed = true
	`).Scan(&cashTotal)
	if cashTotal.Valid {
		stats.ConfirmedCash = cashTotal.Float64
	}

	return stats, nil
}

func (s *AdminDirectionService) ListUsers(search, accountType, status string, limit, offset int) ([]*models.AdminUserListItem, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(LOWER(u.email) LIKE LOWER($%d) OR LOWER(u.first_name) LIKE LOWER($%d) OR LOWER(u.last_name) LIKE LOWER($%d) OR u.phone LIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if accountType != "" {
		conditions = append(conditions, fmt.Sprintf("u.account_type = $%d", argIdx))
		args = append(args, accountType)
		argIdx++
	}

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users u WHERE %s", whereClause)
	var total int
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT 
			u.id, u.first_name, u.middle_name, u.last_name, u.phone, u.email,
			u.status, u.email_verified, u.account_type, u.created_at,
			COALESCE(b.b_count, 0) AS business_count,
			COALESCE(s.s_count, 0) AS shop_count,
			COALESCE(o.o_count, 0) AS order_count,
			COALESCE(p.p_points, 0) AS total_points
		FROM users u
		LEFT JOIN (
			SELECT user_id, COUNT(*) AS b_count FROM business_memberships WHERE role = 'OWNER' GROUP BY user_id
		) b ON u.id = b.user_id
		LEFT JOIN (
			SELECT bm.user_id, COUNT(s.id) AS s_count 
			FROM shops s 
			JOIN business_memberships bm ON s.business_id = bm.business_id AND bm.role = 'OWNER'
			GROUP BY bm.user_id
		) s ON u.id = s.user_id
		LEFT JOIN (
			SELECT bp.user_id, COUNT(ord.id) AS o_count 
			FROM orders ord
			JOIN buyer_profiles bp ON ord.buyer_profile_id = bp.id
			GROUP BY bp.user_id
		) o ON u.id = o.user_id
		LEFT JOIN (
			SELECT owner_id, current_points AS p_points FROM point_accounts
		) p ON u.id = p.owner_id
		WHERE %s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []*models.AdminUserListItem
	for rows.Next() {
		item := &models.AdminUserListItem{}
		err := rows.Scan(
			&item.ID,
			&item.FirstName,
			&item.MiddleName,
			&item.LastName,
			&item.Phone,
			&item.Email,
			&item.Status,
			&item.EmailVerified,
			&item.AccountType,
			&item.CreatedAt,
			&item.BusinessCount,
			&item.ShopCount,
			&item.OrderCount,
			&item.TotalPoints,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan user row: %w", err)
		}
		users = append(users, item)
	}

	return users, total, nil
}

func (s *AdminDirectionService) SuspendUser(adminID uuid.UUID, adminRole models.AdminRole, userID uuid.UUID, reason, ip, userAgent string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return errors.New("USER_NOT_FOUND")
	}

	oldStatus := user.Status
	if oldStatus == models.UserStatusSuspended {
		return errors.New("USER_ALREADY_SUSPENDED")
	}

	// Soft transition to SUSPENDED
	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`
	if _, err := s.db.Exec(query, models.UserStatusSuspended, userID); err != nil {
		return fmt.Errorf("failed to suspend user: %w", err)
	}

	// Immediately revoke all sessions for this user
	_ = s.refreshTokenRepo.RevokeAllForUser(userID)

	// Record immutable audit log
	_ = s.auditService.Record(
		adminID,
		adminRole,
		"USER_SUSPENDED",
		"USER",
		userID.String(),
		reason,
		map[string]interface{}{"status": oldStatus},
		map[string]interface{}{"status": models.UserStatusSuspended},
		ip,
		userAgent,
	)

	return nil
}

func (s *AdminDirectionService) ReactivateUser(adminID uuid.UUID, adminRole models.AdminRole, userID uuid.UUID, reason, ip, userAgent string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return errors.New("USER_NOT_FOUND")
	}

	oldStatus := user.Status
	if oldStatus == models.UserStatusActive {
		return errors.New("USER_ALREADY_ACTIVE")
	}

	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`
	if _, err := s.db.Exec(query, models.UserStatusActive, userID); err != nil {
		return fmt.Errorf("failed to reactivate user: %w", err)
	}

	_ = s.auditService.Record(
		adminID,
		adminRole,
		"USER_REACTIVATED",
		"USER",
		userID.String(),
		reason,
		map[string]interface{}{"status": oldStatus},
		map[string]interface{}{"status": models.UserStatusActive},
		ip,
		userAgent,
	)

	return nil
}

func (s *AdminDirectionService) ForceLogoutUser(adminID uuid.UUID, adminRole models.AdminRole, userID uuid.UUID, reason, ip, userAgent string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return errors.New("USER_NOT_FOUND")
	}

	if err := s.refreshTokenRepo.RevokeAllForUser(userID); err != nil {
		return fmt.Errorf("failed to revoke user sessions: %w", err)
	}

	_ = s.auditService.Record(
		adminID,
		adminRole,
		"USER_FORCE_LOGOUT",
		"USER",
		user.ID.String(),
		reason,
		nil,
		map[string]interface{}{"action": "all_sessions_revoked"},
		ip,
		userAgent,
	)

	return nil
}
