package inventory

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/gin-gonic/gin"
)

func videoErrorStatus(code string) int {
	switch code {
	case "PRODUCT_NOT_FOUND", "VIDEO_NOT_FOUND":
		return http.StatusNotFound
	case "FORBIDDEN":
		return http.StatusForbidden
	case "VIDEO_TOO_LARGE", "INVALID_VIDEO_TYPE", "VIDEO_READ_FAILED", "VIDEO_STORAGE_FAILED", "VIDEO_SAVE_FAILED":
		return http.StatusBadRequest
	}
	return http.StatusInternalServerError
}

// UploadProductVideo stores (or replaces) the product's explainer video.
func (h *Handler) UploadProductVideo(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "A video file is required (field 'file').")
		return
	}
	video, err := h.productVideoService.Upload(userID, businessID, productID, fileHeader)
	if err != nil {
		h.errResponse(c, videoErrorStatus(err.Error()), err.Error(), err.Error())
		return
	}
	c.JSON(http.StatusCreated, models.SuccessResponse{Message: "Video uploaded successfully", Data: video})
}

// GetProductVideo returns the product's video; data is null when it has none.
func (h *Handler) GetProductVideo(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}
	video, err := h.productVideoService.Get(userID, businessID, productID)
	if err != nil {
		h.errResponse(c, videoErrorStatus(err.Error()), err.Error(), err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Product video", Data: video})
}

func (h *Handler) DeleteProductVideo(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}
	if err := h.productVideoService.Remove(userID, businessID, productID); err != nil {
		h.errResponse(c, videoErrorStatus(err.Error()), err.Error(), err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Video deleted successfully"})
}
