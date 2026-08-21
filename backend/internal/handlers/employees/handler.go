package employees

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	employeeService *service.EmployeeService
}

func NewHandler(employeeService *service.EmployeeService) *Handler {
	return &Handler{employeeService: employeeService}
}

func (h *Handler) Create(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	businessIDStr := c.Param("business_id")
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid business ID",
			},
		})
		return
	}

	var req models.CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	employee, err := h.employeeService.CreateEmployee(userID.(uuid.UUID), businessID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Employee created successfully",
		Data: models.EmployeeResponse{
			ID:           employee.ID,
			BusinessID:   employee.BusinessID,
			LinkedUserID: employee.LinkedUserID,
			FirstName:    employee.FirstName,
			MiddleName:   employee.MiddleName,
			LastName:     employee.LastName,
			Phone:        employee.Phone,
			Email:        employee.Email,
			JobTitle:     employee.JobTitle,
			Status:       employee.Status,
			CreatedAt:    employee.CreatedAt,
			UpdatedAt:    employee.UpdatedAt,
		},
	})
}

func (h *Handler) List(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	businessIDStr := c.Param("business_id")
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid business ID",
			},
		})
		return
	}

	employees, err := h.employeeService.ListEmployeesByBusiness(userID.(uuid.UUID), businessID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	responses := make([]models.EmployeeResponse, 0)
	for _, emp := range employees {
		responses = append(responses, models.EmployeeResponse{
			ID:           emp.ID,
			BusinessID:   emp.BusinessID,
			LinkedUserID: emp.LinkedUserID,
			FirstName:    emp.FirstName,
			MiddleName:   emp.MiddleName,
			LastName:     emp.LastName,
			Phone:        emp.Phone,
			Email:        emp.Email,
			JobTitle:     emp.JobTitle,
			Status:       emp.Status,
			CreatedAt:    emp.CreatedAt,
			UpdatedAt:    emp.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employees retrieved successfully",
		Data:    responses,
	})
}

func (h *Handler) Get(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	employee, err := h.employeeService.GetEmployeeByID(userID.(uuid.UUID), employeeID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee retrieved successfully",
		Data: models.EmployeeResponse{
			ID:           employee.ID,
			BusinessID:   employee.BusinessID,
			LinkedUserID: employee.LinkedUserID,
			FirstName:    employee.FirstName,
			MiddleName:   employee.MiddleName,
			LastName:     employee.LastName,
			Phone:        employee.Phone,
			Email:        employee.Email,
			JobTitle:     employee.JobTitle,
			Status:       employee.Status,
			CreatedAt:    employee.CreatedAt,
			UpdatedAt:    employee.UpdatedAt,
		},
	})
}

func (h *Handler) Update(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	var req models.UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	employee, err := h.employeeService.UpdateEmployee(userID.(uuid.UUID), employeeID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee updated successfully",
		Data: models.EmployeeResponse{
			ID:           employee.ID,
			BusinessID:   employee.BusinessID,
			LinkedUserID: employee.LinkedUserID,
			FirstName:    employee.FirstName,
			MiddleName:   employee.MiddleName,
			LastName:     employee.LastName,
			Phone:        employee.Phone,
			Email:        employee.Email,
			JobTitle:     employee.JobTitle,
			Status:       employee.Status,
			CreatedAt:    employee.CreatedAt,
			UpdatedAt:    employee.UpdatedAt,
		},
	})
}

func (h *Handler) AssignToShop(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	var req models.AssignEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	assignment, err := h.employeeService.AssignEmployeeToShop(userID.(uuid.UUID), employeeID, shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "ALREADY_ASSIGNED":
			statusCode = http.StatusConflict
			errorCode = "ALREADY_ASSIGNED"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Employee assigned to shop successfully",
		Data: models.AssignmentResponse{
			ID:         assignment.ID,
			EmployeeID: assignment.EmployeeID,
			ShopID:     assignment.ShopID,
			AssignedBy: assignment.AssignedBy,
			Status:     assignment.Status,
			AssignedAt: assignment.AssignedAt,
		},
	})
}

func (h *Handler) RemoveFromShop(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	err = h.employeeService.RemoveEmployeeFromShop(userID.(uuid.UUID), employeeID, shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee removed from shop successfully",
	})
}

func (h *Handler) ListShopEmployees(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	employees, err := h.employeeService.ListShopEmployees(userID.(uuid.UUID), shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	var responses []models.EmployeeResponse
	for _, emp := range employees {
		responses = append(responses, models.EmployeeResponse{
			ID:           emp.ID,
			BusinessID:   emp.BusinessID,
			LinkedUserID: emp.LinkedUserID,
			FirstName:    emp.FirstName,
			MiddleName:   emp.MiddleName,
			LastName:     emp.LastName,
			Phone:        emp.Phone,
			Email:        emp.Email,
			JobTitle:     emp.JobTitle,
			Status:       emp.Status,
			CreatedAt:    emp.CreatedAt,
			UpdatedAt:    emp.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop employees retrieved successfully",
		Data:    responses,
	})
}

func (h *Handler) ListEmployeeShops(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	shops, err := h.employeeService.ListEmployeeShops(userID.(uuid.UUID), employeeID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	var responses []models.ShopResponse
	for _, shop := range shops {
		responses = append(responses, models.ShopResponse{
			ID:         shop.ID,
			BusinessID: shop.BusinessID,
			Name:       shop.Name,
			Type:       shop.Type,
			City:       shop.City,
			Address:    shop.Address,
			Phone:      shop.Phone,
			Status:     shop.Status,
			CreatedAt:  shop.CreatedAt,
			UpdatedAt:  shop.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee shops retrieved successfully",
		Data:    responses,
	})
}

func (h *Handler) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employee, shops, err := h.employeeService.GetEmployeeWorkspaceByUserID(userID.(uuid.UUID))
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	var shopResponses []models.ShopResponse
	for _, shop := range shops {
		shopResponses = append(shopResponses, models.ShopResponse{
			ID:         shop.ID,
			BusinessID: shop.BusinessID,
			Name:       shop.Name,
			Type:       shop.Type,
			City:       shop.City,
			Address:    shop.Address,
			Phone:      shop.Phone,
			Status:     shop.Status,
			CreatedAt:  shop.CreatedAt,
			UpdatedAt:  shop.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee workspace retrieved successfully",
		Data: map[string]interface{}{
			"employee": models.EmployeeResponse{
				ID:           employee.ID,
				BusinessID:   employee.BusinessID,
				LinkedUserID: employee.LinkedUserID,
				FirstName:    employee.FirstName,
				MiddleName:   employee.MiddleName,
				LastName:     employee.LastName,
				Phone:        employee.Phone,
				Email:        employee.Email,
				JobTitle:     employee.JobTitle,
				Status:       employee.Status,
				CreatedAt:    employee.CreatedAt,
				UpdatedAt:    employee.UpdatedAt,
			},
			"shops": shopResponses,
		},
	})
}

func (h *Handler) CreateInvitation(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	employeeIDStr := c.Param("employee_id")
	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid employee ID",
			},
		})
		return
	}

	var req models.CreateEmployeeInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	if req.EmployeeID != employeeID {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Employee ID mismatch",
			},
		})
		return
	}

	employee, err := h.employeeService.GetEmployeeByID(userID.(uuid.UUID), employeeID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	invitation, rawToken, err := h.employeeService.CreateEmployeeInvitation(userID.(uuid.UUID), employee.BusinessID, employeeID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		case "EMPLOYEE_EMAIL_REQUIRED":
			statusCode = http.StatusBadRequest
			errorCode = "EMPLOYEE_EMAIL_REQUIRED"
		case "INVITATION_ALREADY_PENDING":
			statusCode = http.StatusConflict
			errorCode = "INVITATION_ALREADY_PENDING"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Invitation sent successfully",
		Data: models.EmployeeInvitationResponse{
			ID:            invitation.ID,
			EmployeeID:    invitation.EmployeeID,
			Status:        invitation.Status,
			ExpiresAt:     invitation.ExpiresAt,
			InvitationURL: h.employeeService.BuildEmployeeInvitationURL(rawToken),
			CreatedAt:     invitation.CreatedAt,
		},
	})
}
