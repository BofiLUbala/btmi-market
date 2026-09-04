package admin

import (
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"strconv"
	"strings"
)

type AdminPhase5Handler struct{ s *service.AdminPhase5Service }

func NewAdminPhase5Handler(s *service.AdminPhase5Service) *AdminPhase5Handler {
	return &AdminPhase5Handler{s: s}
}
func phase5Actor(c *gin.Context) (uuid.UUID, models.AdminRole) {
	return c.MustGet("admin_id").(uuid.UUID), c.MustGet("admin_role").(models.AdminRole)
}
func phase5Fail(c *gin.Context, e error) {
	status := http.StatusBadRequest
	if strings.HasPrefix(e.Error(), "forbidden") {
		status = 403
	}
	c.JSON(status, gin.H{"error": e.Error()})
}
func (h *AdminPhase5Handler) GetMaintenance(c *gin.Context) {
	x, e := h.s.GetMaintenance(c)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, x)
}
func (h *AdminPhase5Handler) UpdateMaintenance(c *gin.Context) {
	id, r := phase5Actor(c)
	var q models.UpdateMaintenanceRequest
	if e := c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	if e := h.s.UpdateMaintenance(c, id, r, q); e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"message": "maintenance updated"})
}
func (h *AdminPhase5Handler) ListAnnouncements(c *gin.Context) {
	x, e := h.s.ListAnnouncements(c)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"announcements": x})
}
func (h *AdminPhase5Handler) CreateAnnouncement(c *gin.Context) {
	id, r := phase5Actor(c)
	var q models.AnnouncementRequest
	if e := c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	x, e := h.s.CreateAnnouncement(c, id, r, q)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(201, x)
}
func (h *AdminPhase5Handler) UpdateAnnouncement(c *gin.Context) {
	id, r := phase5Actor(c)
	aid, e := uuid.Parse(c.Param("id"))
	if e != nil {
		phase5Fail(c, e)
		return
	}
	var q models.AnnouncementRequest
	if e = c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	if e = h.s.UpdateAnnouncement(c, id, r, aid, q); e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"message": "announcement updated"})
}
func (h *AdminPhase5Handler) ListApprovals(c *gin.Context) {
	x, e := h.s.ListApprovals(c)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"approvals": x})
}
func (h *AdminPhase5Handler) CreateApproval(c *gin.Context) {
	id, r := phase5Actor(c)
	var q models.CreateApprovalRequest
	if e := c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	x, e := h.s.CreateApproval(c, id, r, q)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(201, gin.H{"id": x})
}
func (h *AdminPhase5Handler) decide(c *gin.Context, yes bool) {
	id, r := phase5Actor(c)
	aid, e := uuid.Parse(c.Param("id"))
	if e != nil {
		phase5Fail(c, e)
		return
	}
	var q models.DecisionRequest
	if e = c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	if e = h.s.DecideApproval(c, id, r, aid, yes, q.Reason); e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"message": "approval resolved"})
}
func (h *AdminPhase5Handler) Approve(c *gin.Context) { h.decide(c, true) }
func (h *AdminPhase5Handler) Reject(c *gin.Context)  { h.decide(c, false) }
func (h *AdminPhase5Handler) ListExports(c *gin.Context) {
	id, r := phase5Actor(c)
	x, e := h.s.ListExports(c, id, r)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"exports": x})
}
func (h *AdminPhase5Handler) CreateExport(c *gin.Context) {
	id, r := phase5Actor(c)
	var q models.CreateExportRequest
	if e := c.ShouldBindJSON(&q); e != nil {
		phase5Fail(c, e)
		return
	}
	x, e := h.s.CreateExport(c, id, r, q)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(202, gin.H{"id": x, "status": "QUEUED"})
}
func (h *AdminPhase5Handler) Analytics(c *gin.Context) {
	_, r := phase5Actor(c)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	x, e := h.s.Analytics(c, r, c.Param("dashboard"), days)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, gin.H{"metrics": x, "days": days})
}
func (h *AdminPhase5Handler) PublicState(c *gin.Context) {
	x, e := h.s.PublicState(c)
	if e != nil {
		phase5Fail(c, e)
		return
	}
	c.JSON(200, x)
}
