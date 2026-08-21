package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type LevelRepository struct {
	db *database.DB
}

func NewLevelRepository(db *database.DB) *LevelRepository {
	return &LevelRepository{db: db}
}

func (r *LevelRepository) GetSellerLevelByName(name string) (*models.SellerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at
		FROM seller_levels WHERE name = $1
	`
	l := &models.SellerLevel{}
	err := r.db.QueryRow(query, name).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.SearchBoost,
		&l.RecommendationEligible, &l.HighValueBuyerAccess, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetSellerLevelByID(id uuid.UUID) (*models.SellerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at
		FROM seller_levels WHERE id = $1
	`
	l := &models.SellerLevel{}
	err := r.db.QueryRow(query, id).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.SearchBoost,
		&l.RecommendationEligible, &l.HighValueBuyerAccess, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetSellerLevelByPoints(points int) (*models.SellerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at
		FROM seller_levels WHERE $1 >= min_points AND $1 <= max_points
	`
	l := &models.SellerLevel{}
	err := r.db.QueryRow(query, points).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.SearchBoost,
		&l.RecommendationEligible, &l.HighValueBuyerAccess, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetSellerNextLevel(currentPoints int) (*models.SellerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at
		FROM seller_levels WHERE min_points > $1
		ORDER BY min_points ASC
		LIMIT 1
	`
	l := &models.SellerLevel{}
	err := r.db.QueryRow(query, currentPoints).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.SearchBoost,
		&l.RecommendationEligible, &l.HighValueBuyerAccess, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetAllSellerLevels() ([]*models.SellerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at
		FROM seller_levels ORDER BY min_points ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var levels []*models.SellerLevel
	for rows.Next() {
		l := &models.SellerLevel{}
		if err := rows.Scan(
			&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.SearchBoost,
			&l.RecommendationEligible, &l.HighValueBuyerAccess, &l.Description, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		levels = append(levels, l)
	}
	return levels, rows.Err()
}

func (r *LevelRepository) GetBuyerLevelByName(name string) (*models.BuyerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description, created_at
		FROM buyer_levels WHERE name = $1
	`
	l := &models.BuyerLevel{}
	err := r.db.QueryRow(query, name).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.DiscountPercent,
		&l.DeliveryDiscountPercent, &l.FreeDelivery, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetBuyerLevelByID(id uuid.UUID) (*models.BuyerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description, created_at
		FROM buyer_levels WHERE id = $1
	`
	l := &models.BuyerLevel{}
	err := r.db.QueryRow(query, id).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.DiscountPercent,
		&l.DeliveryDiscountPercent, &l.FreeDelivery, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetBuyerLevelByPoints(points int) (*models.BuyerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description, created_at
		FROM buyer_levels WHERE $1 >= min_points AND $1 <= max_points
	`
	l := &models.BuyerLevel{}
	err := r.db.QueryRow(query, points).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.DiscountPercent,
		&l.DeliveryDiscountPercent, &l.FreeDelivery, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetBuyerNextLevel(currentPoints int) (*models.BuyerLevel, error) {
	query := `
		SELECT id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description, created_at
		FROM buyer_levels WHERE min_points > $1
		ORDER BY min_points ASC
		LIMIT 1
	`
	l := &models.BuyerLevel{}
	err := r.db.QueryRow(query, currentPoints).Scan(
		&l.ID, &l.Name, &l.MinPoints, &l.MaxPoints, &l.DiscountPercent,
		&l.DeliveryDiscountPercent, &l.FreeDelivery, &l.Description, &l.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func (r *LevelRepository) GetBenefitsByLevel(levelType, levelName string) ([]*models.LevelBenefit, error) {
	query := `
		SELECT id, level_type, level_name, benefit_type, benefit_value, status, created_at
		FROM level_benefits WHERE level_type = $1 AND level_name = $2 AND status = 'ACTIVE'
	`
	rows, err := r.db.Query(query, levelType, levelName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var benefits []*models.LevelBenefit
	for rows.Next() {
		b := &models.LevelBenefit{}
		if err := rows.Scan(
			&b.ID, &b.LevelType, &b.LevelName, &b.BenefitType, &b.BenefitValue, &b.Status, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		benefits = append(benefits, b)
	}
	return benefits, rows.Err()
}
