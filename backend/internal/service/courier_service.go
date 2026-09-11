package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrCourierNotFound          = errors.New("COURIER_NOT_FOUND")
	ErrCourierNotActive         = errors.New("COURIER_NOT_ACTIVE")
	ErrCourierSuspended         = errors.New("COURIER_SUSPENDED")
	ErrCourierAlreadyExists     = errors.New("COURIER_ALREADY_EXISTS")
	ErrInvitationNotFound       = errors.New("INVITATION_NOT_FOUND")
	ErrInvitationExpired        = errors.New("INVITATION_EXPIRED")
	ErrInvitationAlreadyUsed    = errors.New("INVITATION_ALREADY_USED")
	ErrMissionNotFound          = errors.New("MISSION_NOT_FOUND")
	ErrMissionAlreadyAccepted   = errors.New("MISSION_ALREADY_ACCEPTED")
	ErrMissionAlreadyRejected   = errors.New("MISSION_ALREADY_REJECTED")
	ErrNotYourMission           = errors.New("NOT_YOUR_MISSION")
	ErrInvalidStatusTransition  = errors.New("INVALID_STATUS_TRANSITION")
	ErrPasswordMismatch         = errors.New("PASSWORD_MISMATCH")
	ErrEmailAlreadyExists       = errors.New("EMAIL_ALREADY_EXISTS")
	ErrCourierManagementForbidden = errors.New("FORBIDDEN")
)

type CourierService struct {
	courierRepo *repository.CourierRepository
	userRepo    *repository.UserRepository
	shopRepo    *repository.ShopRepository
	commSvc     *CommunicationService
	auditRepo   *repository.AuditRepository
	db          *database.DB
}

func NewCourierService(
	courierRepo *repository.CourierRepository,
	userRepo *repository.UserRepository,
	shopRepo *repository.ShopRepository,
	auditRepo *repository.AuditRepository,
	db *database.DB,
) *CourierService {
	return &CourierService{
		courierRepo: courierRepo,
		userRepo:    userRepo,
		shopRepo:    shopRepo,
		auditRepo:   auditRepo,
		db:          db,
	}
}

func (s *CourierService) SetCommunicationService(commSvc *CommunicationService) {
	s.commSvc = commSvc
}

// hashToken creates a SHA-256 hash of the token for secure storage
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// generateToken creates a cryptographically secure random token
func generateToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(b)
	return token, hashToken(token), nil
}

// InviteCourier creates a new courier invitation
func (s *CourierService) InviteCourier(
	adminID uuid.UUID,
	req *models.InviteCourierRequest,
	ip, userAgent string,
) (string, error) {
	// Check if user already exists
	existingUser, _ := s.userRepo.GetByEmail(req.Email)
	if existingUser != nil {
		// Check if they already have a courier profile
		existingCourier, _ := s.courierRepo.GetByUserID(existingUser.ID)
		if existingCourier != nil {
			return "", ErrCourierAlreadyExists
		}
	}

	// Generate invitation token
	token, tokenHash, err := generateToken()
	if err != nil {
		return "", err
	}

	inv := &models.CourierInvitation{
		ID:        uuid.New(),
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Phone:     &req.Phone,
		TransportType: &req.TransportType,
		VehicleInfo:   &req.VehicleInfo,
		ServiceZone:   &req.ServiceZone,
		TokenHash:     tokenHash,
		Status:        "PENDING",
		ExpiresAt:     time.Now().Add(7 * 24 * time.Hour),
		InvitedBy:     &adminID,
	}

	if err := s.courierRepo.InvitationCreate(inv); err != nil {
		return "", err
	}

	// Record audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: adminID,
			ActorRole:    "COMMERCE_ADMIN",
			Action:       "COURIER_INVITED",
			TargetType:   "COURIER",
			TargetID:     inv.ID.String(),
			Reason:       fmt.Sprintf("Courier invitation sent to %s", req.Email),
			IPAddress:    &ip,
			UserAgent:    &userAgent,
		})
	}

	return token, nil
}

// VerifyInvitation verifies a courier invitation token
func (s *CourierService) VerifyInvitation(token string) (*models.CourierInvitation, error) {
	tokenHash := hashToken(token)
	inv, err := s.courierRepo.InvitationGetByTokenHash(tokenHash)
	if err != nil || inv == nil {
		return nil, ErrInvitationNotFound
	}
	if inv.Status != "PENDING" {
		return nil, ErrInvitationAlreadyUsed
	}
	if time.Now().After(inv.ExpiresAt) {
		return nil, ErrInvitationExpired
	}
	return inv, nil
}

// AcceptInvitation activates a courier account from invitation
func (s *CourierService) AcceptInvitation(token, password, passwordConfirm string) error {
	if password != passwordConfirm {
		return ErrPasswordMismatch
	}

	tokenHash := hashToken(token)
	inv, err := s.courierRepo.InvitationGetByTokenHash(tokenHash)
	if err != nil || inv == nil {
		return ErrInvitationNotFound
	}
	if inv.Status != "PENDING" {
		return ErrInvitationAlreadyUsed
	}
	if time.Now().After(inv.ExpiresAt) {
		return ErrInvitationExpired
	}

	// Create or link user
	var user *models.User
	var existingErr error
	user, existingErr = s.userRepo.GetByEmail(inv.Email)

	if existingErr != nil || user == nil {
		// Create new user
		user = &models.User{
			ID:            uuid.New(),
			FirstName:     inv.FirstName,
			LastName:      inv.LastName,
			Phone:         "",
			Email:         inv.Email,
			Status:        models.UserStatusActive,
			AccountType:   models.AccountTypeEmployee,
			EmailVerified: true,
		}
		if inv.Phone != nil {
			user.Phone = *inv.Phone
		}
		if err := s.userRepo.CreateWithPassword(user, password); err != nil {
			return err
		}
	} else {
		// User exists, set password
		if err := s.userRepo.SetPassword(user.ID, password); err != nil {
			return err
		}
	}

	// Create courier profile
	courier := &models.Courier{
		ID:            uuid.New(),
		UserID:        user.ID,
		Status:        models.CourierStatusActive,
		Availability:  models.CourierAvailabilityUnavailable,
		TransportType: "",
	}
	if inv.TransportType != nil {
		courier.TransportType = *inv.TransportType
	}
	if inv.VehicleInfo != nil {
		courier.VehicleInfo = inv.VehicleInfo
	}
	if inv.ServiceZone != nil {
		courier.ServiceZone = inv.ServiceZone
	}

	if err := s.courierRepo.Create(courier); err != nil {
		return err
	}

	// Update invitation status
	if err := s.courierRepo.InvitationUpdateStatus(inv.ID, "ACCEPTED"); err != nil {
		return err
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: user.ID,
			ActorRole:    "COURIER",
			Action:       "COURIER_ACTIVATED",
			TargetType:   "COURIER",
			TargetID:     courier.ID.String(),
			Reason:       "Courier account activated via invitation",
		})
	}

	return nil
}

// GetCourierProfile returns the courier profile for a user
func (s *CourierService) GetCourierProfile(userID uuid.UUID) (*models.CourierResponse, error) {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil || user == nil {
		return nil, ErrCourierNotFound
	}

	activeMissions, _ := s.courierRepo.CountActiveMissions(userID)
	completedToday, _ := s.courierRepo.CountTodayDeliveries(userID)
	totalDeliveries, _ := s.courierRepo.CountTotalDeliveries(userID)

	return &models.CourierResponse{
		ID:              courier.ID,
		UserID:          courier.UserID,
		FirstName:       user.FirstName,
		LastName:        user.LastName,
		Email:           user.Email,
		Phone:           user.Phone,
		Status:          courier.Status,
		Availability:    courier.Availability,
		TransportType:   courier.TransportType,
		VehicleInfo:     courier.VehicleInfo,
		ServiceZone:     courier.ServiceZone,
		ActiveMissions:  activeMissions,
		CompletedToday:  completedToday,
		TotalDeliveries: totalDeliveries,
		ActivatedAt:     courier.ActivatedAt,
		SuspendedAt:     courier.SuspendedAt,
		SuspensionReason: courier.SuspensionReason,
		CreatedAt:       courier.CreatedAt,
		UpdatedAt:       courier.UpdatedAt,
	}, nil
}

// UpdateAvailability updates the courier's availability
func (s *CourierService) UpdateAvailability(userID uuid.UUID, availability models.CourierAvailability) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}
	if courier.Status != models.CourierStatusActive {
		return ErrCourierNotActive
	}
	return s.courierRepo.UpdateAvailability(courier.ID, availability)
}

// GetDashboard returns the courier dashboard overview
func (s *CourierService) GetDashboard(userID uuid.UUID) (*models.CourierDashboardResponse, error) {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}

	pendingMissions, _ := s.courierRepo.CountActiveMissions(userID)
	completedToday, _ := s.courierRepo.CountTodayDeliveries(userID)
	failedToday, _ := s.courierRepo.CountTodayFailed(userID)

	// Get current mission if any
	missions, _ := s.courierRepo.GetMissions(userID)
	var currentMission *models.CourierMissionResponse
	for _, m := range missions {
		if m.DeliveryStatus == "COURIER_ASSIGNED" || m.DeliveryStatus == "PICKED_UP" || m.DeliveryStatus == "IN_TRANSIT" {
			currentMission = m
			break
		}
	}

	return &models.CourierDashboardResponse{
		Availability:    courier.Availability,
		PendingMissions: pendingMissions,
		ActiveMissions:  pendingMissions,
		DeliveriesToday: completedToday + failedToday,
		CompletedToday:  completedToday,
		FailedToday:     failedToday,
		CurrentMission:  currentMission,
	}, nil
}

// GetMissions returns all missions for a courier
func (s *CourierService) GetMissions(userID uuid.UUID) ([]*models.CourierMissionResponse, error) {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}
	return s.courierRepo.GetMissions(userID)
}

// GetMissionByID returns a single mission for a courier
func (s *CourierService) GetMissionByID(userID, orderID uuid.UUID) (*models.CourierMissionResponse, error) {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}
	return s.courierRepo.GetMissionByID(userID, orderID)
}

// AcceptMission accepts a delivery mission
func (s *CourierService) AcceptMission(userID, orderID uuid.UUID) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}
	if courier.Status != models.CourierStatusActive {
		return ErrCourierNotActive
	}

	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return ErrMissionNotFound
	}
	if order.DeliveryStatus != "COURIER_ASSIGNED" {
		return ErrMissionAlreadyAccepted
	}

	// Update order status
	if err := s.courierRepo.UpdateMissionStatus(orderID, "courier_accepted_at", time.Now()); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "delivery_status", "COURIER_ACCEPTED"); err != nil {
		return err
	}

	// Set courier to BUSY if they have active missions
	if err := s.courierRepo.UpdateAvailability(courier.ID, models.CourierAvailabilityBusy); err != nil {
		return err
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: userID,
			ActorRole:    "COURIER",
			Action:       "MISSION_ACCEPTED",
			TargetType:   "ORDER",
			TargetID:     orderID.String(),
			Reason:       "Courier accepted delivery mission",
		})
	}

	// Notify commerce admin
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeOrderAccepted, map[string]interface{}{
			"courier_user_id": userID.String(),
			"action":          "MISSION_ACCEPTED",
		})
	}

	return nil
}

// RejectMission rejects a delivery mission
func (s *CourierService) RejectMission(userID, orderID uuid.UUID, reason string) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return ErrMissionNotFound
	}
	if order.DeliveryStatus != "COURIER_ASSIGNED" {
		return ErrMissionAlreadyRejected
	}

	// Update order
	if err := s.courierRepo.UpdateMissionStatus(orderID, "courier_rejected_at", time.Now()); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "courier_rejection_reason", reason); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "delivery_status", "COURIER_REJECTED"); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "assigned_courier_id", nil); err != nil {
		return err
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: userID,
			ActorRole:    "COURIER",
			Action:       "MISSION_REJECTED",
			TargetType:   "ORDER",
			TargetID:     orderID.String(),
			Reason:       reason,
		})
	}

	// Notify commerce admin
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeOrderRejected, map[string]interface{}{
			"courier_user_id": userID.String(),
			"action":          "MISSION_REJECTED",
			"reason":          reason,
		})
	}

	return nil
}

// StartDelivery marks the delivery as started (IN_TRANSIT)
func (s *CourierService) StartDelivery(userID, orderID uuid.UUID) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return ErrMissionNotFound
	}
	if order.DeliveryStatus != "COURIER_ACCEPTED" && order.DeliveryStatus != "READY_FOR_PICKUP" {
		return ErrInvalidStatusTransition
	}

	if err := s.courierRepo.UpdateMissionStatus(orderID, "courier_started_at", time.Now()); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "delivery_status", "IN_TRANSIT"); err != nil {
		return err
	}

	// Notify buyer
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierPickedUp, map[string]interface{}{
			"courier_user_id": userID.String(),
		})
	}

	return nil
}

// ArriveAtDestination marks the courier as arrived
func (s *CourierService) ArriveAtDestination(userID, orderID uuid.UUID) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return ErrMissionNotFound
	}
	if order.DeliveryStatus != "IN_TRANSIT" {
		return ErrInvalidStatusTransition
	}

	if err := s.courierRepo.UpdateMissionStatus(orderID, "courier_arrived_at", time.Now()); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "delivery_status", "COURIER_ARRIVED"); err != nil {
		return err
	}

	// Notify buyer
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierArrived, map[string]interface{}{
			"courier_user_id": userID.String(),
		})
	}

	return nil
}

// FailDelivery marks a delivery as failed
func (s *CourierService) FailDelivery(userID, orderID uuid.UUID, reason, notes string) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return ErrMissionNotFound
	}

	if err := s.courierRepo.UpdateMissionStatus(orderID, "failed_delivery_reason", reason); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "failed_delivery_notes", notes); err != nil {
		return err
	}
	if err := s.courierRepo.UpdateMissionStatus(orderID, "delivery_status", "FAILED"); err != nil {
		return err
	}

	// Check if courier has any more active missions, if not, set to AVAILABLE
	activeMissions, _ := s.courierRepo.CountActiveMissions(userID)
	if activeMissions == 0 {
		_ = s.courierRepo.UpdateAvailability(courier.ID, models.CourierAvailabilityAvailable)
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: userID,
			ActorRole:    "COURIER",
			Action:       "DELIVERY_FAILED",
			TargetType:   "ORDER",
			TargetID:     orderID.String(),
			Reason:       fmt.Sprintf("Reason: %s, Notes: %s", reason, notes),
		})
	}

	// Notify commerce admin
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeDeliveryFailed, map[string]interface{}{
			"courier_user_id": userID.String(),
			"reason":          reason,
			"notes":           notes,
		})
	}

	return nil
}

// GetHistory returns delivery history for a courier
func (s *CourierService) GetHistory(userID uuid.UUID, limit, offset int) ([]*models.CourierHistoryResponse, error) {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}
	return s.courierRepo.GetHistory(userID, limit, offset)
}

// ListAllCouriers returns all couriers for Commerce Admin
func (s *CourierService) ListAllCouriers(limit, offset int) ([]*models.CourierResponse, int, error) {
	couriers, err := s.courierRepo.ListAll(limit, offset)
	if err != nil {
		return nil, 0, err
	}

	var responses []*models.CourierResponse
	for _, c := range couriers {
		user, _ := s.userRepo.GetByID(c.UserID)
		if user == nil {
			continue
		}
		activeMissions, _ := s.courierRepo.CountActiveMissions(c.UserID)
		completedToday, _ := s.courierRepo.CountTodayDeliveries(c.UserID)
		totalDeliveries, _ := s.courierRepo.CountTotalDeliveries(c.UserID)

		responses = append(responses, &models.CourierResponse{
			ID:              c.ID,
			UserID:          c.UserID,
			FirstName:       user.FirstName,
			LastName:        user.LastName,
			Email:           user.Email,
			Phone:           user.Phone,
			Status:          c.Status,
			Availability:    c.Availability,
			TransportType:   c.TransportType,
			VehicleInfo:     c.VehicleInfo,
			ServiceZone:     c.ServiceZone,
			ActiveMissions:  activeMissions,
			CompletedToday:  completedToday,
			TotalDeliveries: totalDeliveries,
			ActivatedAt:     c.ActivatedAt,
			SuspendedAt:     c.SuspendedAt,
			SuspensionReason: c.SuspensionReason,
			CreatedAt:       c.CreatedAt,
			UpdatedAt:       c.UpdatedAt,
		})
	}

	return responses, len(responses), nil
}

// GetAvailableCouriers returns available couriers for assignment
func (s *CourierService) GetAvailableCouriers() ([]*models.CourierResponse, error) {
	couriers, err := s.courierRepo.ListAvailableCouriers()
	if err != nil {
		return nil, err
	}

	var responses []*models.CourierResponse
	for _, c := range couriers {
		user, _ := s.userRepo.GetByID(c.UserID)
		if user == nil {
			continue
		}
		activeMissions, _ := s.courierRepo.CountActiveMissions(c.UserID)

		responses = append(responses, &models.CourierResponse{
			ID:              c.ID,
			UserID:          c.UserID,
			FirstName:       user.FirstName,
			LastName:        user.LastName,
			Email:           user.Email,
			Phone:           user.Phone,
			Status:          c.Status,
			Availability:    c.Availability,
			TransportType:   c.TransportType,
			VehicleInfo:     c.VehicleInfo,
			ServiceZone:     c.ServiceZone,
			ActiveMissions:  activeMissions,
			ActivatedAt:     c.ActivatedAt,
			CreatedAt:       c.CreatedAt,
			UpdatedAt:       c.UpdatedAt,
		})
	}

	return responses, nil
}

// SuspendCourier suspends a courier (Commerce Admin)
func (s *CourierService) SuspendCourier(adminID uuid.UUID, courierID uuid.UUID, reason, ip, userAgent string) error {
	courier, err := s.courierRepo.GetByID(courierID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	if err := s.courierRepo.Suspend(courierID, reason); err != nil {
		return err
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: adminID,
			ActorRole:    "COMMERCE_ADMIN",
			Action:       "COURIER_SUSPENDED",
			TargetType:   "COURIER",
			TargetID:     courierID.String(),
			Reason:       reason,
			IPAddress:    &ip,
			UserAgent:    &userAgent,
		})
	}

	return nil
}

// ReactivateCourier reactivates a suspended courier (Commerce Admin)
func (s *CourierService) ReactivateCourier(adminID uuid.UUID, courierID uuid.UUID, ip, userAgent string) error {
	courier, err := s.courierRepo.GetByID(courierID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}

	if err := s.courierRepo.Reactivate(courierID); err != nil {
		return err
	}

	// Audit event
	if s.auditRepo != nil {
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: adminID,
			ActorRole:    "COMMERCE_ADMIN",
			Action:       "COURIER_REACTIVATED",
			TargetType:   "COURIER",
			TargetID:     courierID.String(),
			Reason:       "Courier reactivated by admin",
			IPAddress:    &ip,
			UserAgent:    &userAgent,
		})
	}

	return nil
}

// IsCourier checks if a user has an active courier profile
func (s *CourierService) IsCourier(userID uuid.UUID) bool {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return false
	}
	return courier.Status == models.CourierStatusActive
}

// RequireActiveCourier checks if the user is an active courier, returns error if not
func (s *CourierService) RequireActiveCourier(userID uuid.UUID) error {
	courier, err := s.courierRepo.GetByUserID(userID)
	if err != nil || courier == nil {
		return ErrCourierNotFound
	}
	if courier.Status != models.CourierStatusActive {
		if courier.Status == models.CourierStatusSuspended {
			return ErrCourierSuspended
		}
		return ErrCourierNotActive
	}
	return nil
}

// GetCourierDetailForAdmin returns detailed courier info for Commerce Admin
func (s *CourierService) GetCourierDetailForAdmin(courierID uuid.UUID) (*models.CourierResponse, error) {
	courier, err := s.courierRepo.GetByID(courierID)
	if err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}

	user, err := s.userRepo.GetByID(courier.UserID)
	if err != nil || user == nil {
		return nil, ErrCourierNotFound
	}

	activeMissions, _ := s.courierRepo.CountActiveMissions(courier.UserID)
	completedToday, _ := s.courierRepo.CountTodayDeliveries(courier.UserID)
	totalDeliveries, _ := s.courierRepo.CountTotalDeliveries(courier.UserID)

	return &models.CourierResponse{
		ID:              courier.ID,
		UserID:          courier.UserID,
		FirstName:       user.FirstName,
		LastName:        user.LastName,
		Email:           user.Email,
		Phone:           user.Phone,
		Status:          courier.Status,
		Availability:    courier.Availability,
		TransportType:   courier.TransportType,
		VehicleInfo:     courier.VehicleInfo,
		ServiceZone:     courier.ServiceZone,
		ActiveMissions:  activeMissions,
		CompletedToday:  completedToday,
		TotalDeliveries: totalDeliveries,
		ActivatedAt:     courier.ActivatedAt,
		SuspendedAt:     courier.SuspendedAt,
		SuspensionReason: courier.SuspensionReason,
		CreatedAt:       courier.CreatedAt,
		UpdatedAt:       courier.UpdatedAt,
	}, nil
}
