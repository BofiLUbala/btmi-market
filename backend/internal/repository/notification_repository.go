package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type NotificationRepository struct {
	db *database.DB
}

func NewNotificationRepository(db *database.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

var ErrNotificationNotFound = fmt.Errorf("notification not found")

// Create persists a new in-app notification.
func (r *NotificationRepository) Create(notif *models.Notification) error {
	if notif.ID == uuid.Nil {
		notif.ID = uuid.New()
	}
	if notif.CreatedAt.IsZero() {
		notif.CreatedAt = time.Now()
	}

	metadataJSON, err := models.MetadataToJSON(notif.Metadata)
	if err != nil {
		metadataJSON = "{}"
	}

	query := `
		INSERT INTO notifications (id, user_id, type, title, body, reference_type, reference_id, metadata, read_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at
	`

	err = r.db.QueryRow(
		query,
		notif.ID,
		notif.UserID,
		notif.Type,
		notif.Title,
		notif.Body,
		notif.ReferenceType,
		notif.ReferenceID,
		metadataJSON,
		notif.ReadAt,
		notif.CreatedAt,
	).Scan(&notif.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert notification: %w", err)
	}

	return nil
}

// GetByUserID retrieves notifications for a user paginated, ordered by created_at DESC.
func (r *NotificationRepository) GetByUserID(userID uuid.UUID, limit, offset int) ([]models.NotificationResponse, int, error) {
	if limit <= 0 {
		limit = 20
	}

	countQuery := `SELECT COUNT(*) FROM notifications WHERE user_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, userID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, user_id, type, title, body, reference_type, reference_id, metadata, read_at, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query notifications: %w", err)
	}
	defer rows.Close()

	var notifs []models.NotificationResponse
	for rows.Next() {
		var n models.NotificationResponse
		var refID uuid.UUID
		var metaRaw []byte
		var readAt sql.NullTime

		err := rows.Scan(
			&n.ID,
			new(uuid.UUID), // user_id (not needed in response, but in query)
			&n.Type,
			&n.Title,
			&n.Body,
			&n.ReferenceType,
			&refID,
			&metaRaw,
			&readAt,
			&n.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan notification: %w", err)
		}

		n.ReferenceID = refID.String()
		n.Metadata = models.JSONToMetadata(metaRaw)
		if readAt.Valid {
			t := readAt.Time
			n.ReadAt = &t
			n.IsRead = true
		} else {
			n.IsRead = false
		}
		notifs = append(notifs, n)
	}

	return notifs, total, nil
}

// MarkAsRead marks a single notification as read for a given user.
func (r *NotificationRepository) MarkAsRead(id, userID uuid.UUID) error {
	query := `
		UPDATE notifications
		SET read_at = NOW()
		WHERE id = $1 AND user_id = $2 AND read_at IS NULL
	`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		// might already be read or not found, but we check if it exists
		var exists bool
		_ = r.db.QueryRow("SELECT EXISTS(SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2)", id, userID).Scan(&exists)
		if !exists {
			return ErrNotificationNotFound
		}
	}
	return nil
}

// MarkAllAsRead marks all unread notifications for a user as read.
func (r *NotificationRepository) MarkAllAsRead(userID uuid.UUID) error {
	query := `
		UPDATE notifications
		SET read_at = NOW()
		WHERE user_id = $1 AND read_at IS NULL
	`
	_, err := r.db.Exec(query, userID)
	return err
}

// GetUnreadCount counts unread notifications for a user.
func (r *NotificationRepository) GetUnreadCount(userID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND read_at IS NULL
	`
	var count int
	err := r.db.QueryRow(query, userID).Scan(&count)
	return count, err
}

// CreateMultiple inserts notifications for multiple users efficiently.
func (r *NotificationRepository) CreateMultiple(notifs []models.Notification) error {
	for i := range notifs {
		if err := r.Create(&notifs[i]); err != nil {
			return err
		}
	}
	return nil
}

// ExistsRecent checks if a notification of the same type and reference exists recently for a user.
func (r *NotificationRepository) ExistsRecent(userID uuid.UUID, notifType models.NotificationType, refType string, refID uuid.UUID, window time.Duration) (bool, error) {
	since := time.Now().Add(-window)
	query := `
		SELECT EXISTS(
			SELECT 1 FROM notifications 
			WHERE user_id = $1 AND type = $2 AND reference_type = $3 AND reference_id = $4 AND created_at >= $5
		)
	`
	var exists bool
	err := r.db.QueryRow(query, userID, string(notifType), refType, refID, since).Scan(&exists)
	return exists, err
}

// CreateIfUnique creates a notification only if an identical notification was not created recently.
func (r *NotificationRepository) CreateIfUnique(notif *models.Notification, window time.Duration) (bool, error) {
	exists, err := r.ExistsRecent(notif.UserID, notif.Type, notif.ReferenceType, notif.ReferenceID, window)
	if err != nil {
		return false, err
	}
	if exists {
		return false, nil
	}
	if err := r.Create(notif); err != nil {
		return false, err
	}
	return true, nil
}

