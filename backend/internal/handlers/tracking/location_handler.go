// Package tracking serves the courier's live position during a delivery.
//
// Write: the assigned courier, from mission acceptance until arrival
// (models.LiveTrackingStatuses).
// Read:  the buyer who owns the order, and Commerce Admin (read-only).
// Sellers, their employees and Finance have no route here.
package tracking

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/maps"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type buyerProfileLookup interface {
	GetProfileByIDFromUser(userID uuid.UUID) (*models.BuyerProfile, error)
}

// addressResolver turns the place names TomTom reports into the ids the
// delivery form stores. Optional: without it the names still come back and the
// buyer picks the province, city and commune themselves.
type addressResolver interface {
	ResolveByNames(province, city, commune string) (*models.ResolvedAddress, error)
}

type LocationHandler struct {
	locations     *service.CourierLocationService
	routes        *service.DeliveryRouteService
	buyerProfiles buyerProfileLookup
	addresses     addressResolver
}

// SetLocationRepository wires the province/city/commune tables in, so a point
// dropped on the map can fill the form's own fields and not just free text.
func (h *LocationHandler) SetLocationRepository(r addressResolver) { h.addresses = r }

func NewLocationHandler(locations *service.CourierLocationService, routes *service.DeliveryRouteService, buyerProfiles buyerProfileLookup) *LocationHandler {
	return &LocationHandler{locations: locations, routes: routes, buyerProfiles: buyerProfiles}
}

func errResponse(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	})
}

func userID(c *gin.Context) (uuid.UUID, bool) {
	raw, _ := c.Get("user_id")
	id, ok := raw.(uuid.UUID)
	if !ok {
		errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
	}
	return id, ok
}

func orderParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// POST /api/v1/courier/missions/:id/location
func (h *LocationHandler) ReportLocation(c *gin.Context) {
	courierUserID, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	var req models.ReportLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_LOCATION", "Invalid location: "+err.Error())
		return
	}
	result, err := h.locations.ReportLocation(courierUserID, orderID, &req)
	var invalid *service.ErrInvalidLocation
	switch {
	case errors.As(err, &invalid):
		errResponse(c, http.StatusUnprocessableEntity, "INVALID_LOCATION", invalid.Error())
	case errors.Is(err, service.ErrTrackingNotActive):
		errResponse(c, http.StatusConflict, "TRACKING_NOT_ACTIVE", "Location sharing is only active while this delivery is in transit")
	case err != nil:
		errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not record location")
	default:
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Location received", Data: result})
	}
}

// GET /api/v1/buyer/orders/:order_id/courier-location
func (h *LocationHandler) BuyerCourierLocation(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "order_id")
	if !ok {
		return
	}
	profile, err := h.buyerProfiles.GetProfileByIDFromUser(uid)
	if err != nil || profile == nil {
		errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", "Buyer profile not found")
		return
	}
	resp, err := h.locations.GetForBuyer(profile.ID, orderID)
	h.respond(c, resp, err)
}

// GET /api/v1/admin/commerce/orders/:id/courier-location
func (h *LocationHandler) AdminCourierLocation(c *gin.Context) {
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.locations.GetForAdmin(orderID)
	h.respond(c, resp, err)
}

func (h *LocationHandler) respond(c *gin.Context, resp *models.CourierLocationResponse, err error) {
	switch {
	case errors.Is(err, service.ErrLocationOrderNotFound):
		errResponse(c, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found")
	case errors.Is(err, service.ErrLocationForbidden):
		errResponse(c, http.StatusForbidden, "FORBIDDEN", "Not your order")
	case err != nil:
		errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load courier location")
	default:
		// A position is live data: never cache it.
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Courier location", Data: resp})
	}
}

// GET /api/v1/courier/missions/:id/live
// The assigned courier's own position, route, progress and instructions.
func (h *LocationHandler) CourierLive(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.locations.GetForCourier(uid, orderID)
	h.respond(c, resp, err)
}

// GET /api/v1/courier/geocode?q=  and  /api/v1/admin/commerce/geocode?q=
// Candidate places for an address. Nothing is chosen for the caller.
func (h *LocationHandler) Geocode(c *gin.Context) {
	candidates, err := h.routes.Geocode(c.Query("q"))
	var invalid *service.ErrInvalidRoutePoint
	switch {
	case errors.As(err, &invalid):
		errResponse(c, http.StatusBadRequest, "INVALID_QUERY", invalid.Error())
	case errors.Is(err, maps.ErrNotConfigured):
		errResponse(c, http.StatusServiceUnavailable, "MAPS_NOT_CONFIGURED", "La recherche d'adresse n'est pas configurée : placez le point sur la carte ou saisissez ses coordonnées")
	case err != nil:
		errResponse(c, http.StatusBadGateway, "GEOCODING_FAILED", "Recherche d'adresse indisponible : placez le point sur la carte ou saisissez ses coordonnées")
	default:
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Candidates", Data: gin.H{"candidates": candidates}})
	}
}

// GET .../reverse-geocode?lng=&lat=
func (h *LocationHandler) ReverseGeocode(c *gin.Context) {
	lng, errLng := strconv.ParseFloat(c.Query("lng"), 64)
	lat, errLat := strconv.ParseFloat(c.Query("lat"), 64)
	if errLng != nil || errLat != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_QUERY", "Coordonnées manquantes ou invalides")
		return
	}
	place, err := h.routes.ReverseGeocode(lng, lat)
	var invalid *service.ErrInvalidRoutePoint
	switch {
	case errors.As(err, &invalid):
		errResponse(c, http.StatusBadRequest, "INVALID_QUERY", invalid.Error())
	case errors.Is(err, maps.ErrNotConfigured):
		errResponse(c, http.StatusServiceUnavailable, "MAPS_NOT_CONFIGURED", "La recherche d'adresse n'est pas configurée : saisissez l'adresse à la main")
	case err != nil:
		errResponse(c, http.StatusBadGateway, "GEOCODING_FAILED", "Recherche d'adresse indisponible : saisissez l'adresse à la main")
	default:
		// No address near the pin is a normal answer, not a failure: the point
		// still stands on its own, and the form stays as the buyer left it.
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Place", Data: gin.H{"place": h.withIDs(place)}})
	}
}

// withIDs answers with the place TomTom named plus, where the names match a
// row we know, the ids the form stores. A name that matches nothing is still
// returned: it tells the buyer roughly where the pin landed even when the
// commune is not one we deliver to, and leaving the id empty keeps the form
// honest about what still has to be chosen by hand.
func (h *LocationHandler) withIDs(place *maps.Place) gin.H {
	if place == nil {
		return nil
	}
	out := gin.H{
		"label": place.Label, "building_number": place.BuildingNumber, "street": place.Street,
		"commune": place.Commune, "city": place.City, "province": place.Province,
		"latitude": place.Latitude, "longitude": place.Longitude, "offset_m": place.OffsetM,
		"province_id": "", "city_id": "", "commune_id": "",
	}
	if h.addresses == nil {
		return out
	}
	resolved, err := h.addresses.ResolveByNames(place.Province, place.City, place.Commune)
	if err != nil || resolved == nil {
		return out
	}
	out["province_id"], out["province"] = resolved.Province.ID.String(), resolved.Province.Name
	out["city_id"], out["city"] = resolved.City.ID.String(), resolved.City.Name
	out["commune_id"], out["commune"] = resolved.Commune.ID.String(), resolved.Commune.Name
	return out
}

// PUT /api/v1/courier/missions/:id/route
func (h *LocationHandler) CourierSetRoute(c *gin.Context) { h.setRoute(c, "COURIER") }

// PUT /api/v1/admin/commerce/orders/:id/route
func (h *LocationHandler) AdminSetRoute(c *gin.Context) { h.setRoute(c, "COMMERCE_ADMIN") }

func (h *LocationHandler) setRoute(c *gin.Context, role string) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	var req models.SetRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_ROUTE", "Itinéraire invalide : "+err.Error())
		return
	}
	_, err := h.routes.SetRoute(uid, role, orderID, &req)
	var invalid *service.ErrInvalidRoutePoint
	switch {
	case errors.As(err, &invalid):
		errResponse(c, http.StatusUnprocessableEntity, "INVALID_ROUTE_POINT", invalid.Error())
	case errors.Is(err, service.ErrRouteNotConfirmed):
		errResponse(c, http.StatusUnprocessableEntity, "ROUTE_NOT_CONFIRMED", "Confirmez le départ et la destination sur la carte avant de calculer l'itinéraire")
	case errors.Is(err, service.ErrRouteNotPlannable):
		errResponse(c, http.StatusConflict, "ROUTE_NOT_PLANNABLE", "L'itinéraire se prépare entre l'affectation du livreur et son arrivée")
	case errors.Is(err, service.ErrLocationOrderNotFound):
		errResponse(c, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found")
	case errors.Is(err, service.ErrLocationForbidden):
		errResponse(c, http.StatusForbidden, "FORBIDDEN", "Not your mission")
	case errors.Is(err, maps.ErrNoRoute):
		errResponse(c, http.StatusUnprocessableEntity, "NO_ROUTE", "Aucune route praticable entre ces deux points : déplacez un point sur une rue")
	case errors.Is(err, maps.ErrNotConfigured):
		errResponse(c, http.StatusServiceUnavailable, "MAPS_NOT_CONFIGURED", "Le calcul d'itinéraire n'est pas configuré sur le serveur")
	case err != nil:
		errResponse(c, http.StatusBadGateway, "ROUTING_FAILED", "Calcul d'itinéraire indisponible, réessayez")
	default:
		var resp *models.CourierLocationResponse
		if role == "COURIER" {
			resp, err = h.locations.GetForCourier(uid, orderID)
		} else {
			resp, err = h.locations.GetForAdmin(orderID)
		}
		h.respond(c, resp, err)
	}
}
