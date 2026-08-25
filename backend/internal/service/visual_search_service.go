package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

const maxVisualSearchBytes = 6 << 20

type visionSearchResponse struct {
	Matches []struct {
		ProductID string  `json:"product_id"`
		Score     float64 `json:"score"`
	} `json:"matches"`
}

func (s *MarketplaceService) SearchProductsByImage(header *multipart.FileHeader, limit int) ([]*models.PublicProductResponse, error) {
	if header == nil {
		return nil, errors.New("IMAGE_REQUIRED")
	}
	if header.Size <= 0 || header.Size > maxVisualSearchBytes {
		return nil, errors.New("IMAGE_TOO_LARGE")
	}
	if strings.TrimSpace(s.visualSearchURL) == "" {
		return nil, errors.New("VISUAL_SEARCH_UNAVAILABLE")
	}
	if limit <= 0 || limit > 30 {
		limit = 20
	}
	source, err := header.Open()
	if err != nil {
		return nil, errors.New("INVALID_IMAGE")
	}
	defer source.Close()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", header.Filename)
	if err != nil {
		return nil, errors.New("INVALID_IMAGE")
	}
	if _, err = io.Copy(part, io.LimitReader(source, maxVisualSearchBytes+1)); err != nil {
		return nil, errors.New("INVALID_IMAGE")
	}
	_ = writer.WriteField("top_k", fmt.Sprintf("%d", limit))
	if err = writer.Close(); err != nil {
		return nil, errors.New("INVALID_IMAGE")
	}
	request, err := http.NewRequest(http.MethodPost, strings.TrimRight(s.visualSearchURL, "/")+"/search", &body)
	if err != nil {
		return nil, errors.New("VISUAL_SEARCH_UNAVAILABLE")
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response, err := (&http.Client{Timeout: 35 * time.Second}).Do(request)
	if err != nil {
		return nil, errors.New("VISUAL_SEARCH_UNAVAILABLE")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusBadRequest || response.StatusCode == http.StatusUnprocessableEntity {
		return nil, errors.New("INVALID_IMAGE")
	}
	if response.StatusCode != http.StatusOK {
		return nil, errors.New("VISUAL_SEARCH_UNAVAILABLE")
	}
	var vision visionSearchResponse
	if err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&vision); err != nil {
		return nil, errors.New("VISUAL_SEARCH_UNAVAILABLE")
	}
	products := make([]*models.PublicProductResponse, 0, len(vision.Matches))
	seen := make(map[uuid.UUID]struct{})
	for _, match := range vision.Matches {
		productID, parseErr := uuid.Parse(match.ProductID)
		if parseErr != nil {
			continue
		}
		if _, exists := seen[productID]; exists {
			continue
		}
		product, productErr := s.marketplaceRepo.GetPublicProductByID(productID)
		if productErr == nil && product != nil {
			seen[productID] = struct{}{}
			products = append(products, product)
		}
	}
	s.attachImages(products)
	return products, nil
}
