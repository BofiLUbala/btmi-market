package service

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

const maxProductVideoBytes = 60 << 20 // 60 MB

var allowedVideoTypes = map[string]string{
	"video/mp4":       "mp4",
	"video/quicktime": "mov",
	"video/webm":      "webm",
	"video/3gpp":      "3gp",
}

// ProductVideoService manages the optional explainer video of a Product.
type ProductVideoService struct {
	videoRepo      *repository.ProductVideoRepository
	productRepo    *repository.ProductRepository
	membershipRepo *repository.MembershipRepository
	uploadDir      string
}

func NewProductVideoService(
	videoRepo *repository.ProductVideoRepository,
	productRepo *repository.ProductRepository,
	membershipRepo *repository.MembershipRepository,
	uploadDir string,
) *ProductVideoService {
	return &ProductVideoService{videoRepo: videoRepo, productRepo: productRepo, membershipRepo: membershipRepo, uploadDir: uploadDir}
}

// attachVideoURLs sets VideoURL on every listed product that has a video.
// Failures are non-fatal: the card just shows its photo instead.
func attachVideoURLs(repo *repository.ProductVideoRepository, lists ...[]*models.PublicProductResponse) {
	if repo == nil {
		return
	}
	var ids []uuid.UUID
	for _, list := range lists {
		for _, p := range list {
			if p != nil {
				ids = append(ids, p.ID)
			}
		}
	}
	urls, err := repo.URLsByProductIDs(ids)
	if err != nil {
		return
	}
	for _, list := range lists {
		for _, p := range list {
			if p != nil {
				p.VideoURL = urls[p.ID]
			}
		}
	}
}

func toVideoResponse(v *models.ProductVideo) *models.ProductVideoResponse {
	return &models.ProductVideoResponse{
		ID: v.ID, ProductID: v.ProductID, URL: v.URL, FileName: v.FileName,
		MimeType: v.MimeType, SizeBytes: v.SizeBytes, CreatedAt: v.CreatedAt,
	}
}

func (s *ProductVideoService) authorize(userID, businessID, productID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	product, err := s.productRepo.GetByID(productID)
	if err != nil || product == nil || product.BusinessID != businessID {
		return errors.New("PRODUCT_NOT_FOUND")
	}
	return nil
}

func (s *ProductVideoService) removeFile(url string) {
	clean := strings.TrimPrefix(url, "/uploads/")
	_ = os.Remove(filepath.Join(s.uploadDir, filepath.FromSlash(clean)))
}

// Upload stores the video, replacing the product's previous one.
func (s *ProductVideoService) Upload(userID, businessID, productID uuid.UUID, header *multipart.FileHeader) (*models.ProductVideoResponse, error) {
	if err := s.authorize(userID, businessID, productID); err != nil {
		return nil, err
	}
	if header.Size > maxProductVideoBytes {
		return nil, errors.New("VIDEO_TOO_LARGE")
	}
	mime := header.Header.Get("Content-Type")
	ext, ok := allowedVideoTypes[mime]
	if !ok {
		return nil, errors.New("INVALID_VIDEO_TYPE")
	}

	src, err := header.Open()
	if err != nil {
		return nil, errors.New("VIDEO_READ_FAILED")
	}
	defer src.Close()

	dir := filepath.Join(s.uploadDir, "products", productID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, errors.New("VIDEO_STORAGE_FAILED")
	}
	fileName := fmt.Sprintf("video-%s.%s", uuid.NewString(), ext)
	fullPath := filepath.Join(dir, fileName)
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, errors.New("VIDEO_STORAGE_FAILED")
	}
	written, err := io.Copy(dst, io.LimitReader(src, maxProductVideoBytes+1))
	dst.Close()
	if err != nil || written > maxProductVideoBytes {
		_ = os.Remove(fullPath)
		if err == nil {
			return nil, errors.New("VIDEO_TOO_LARGE")
		}
		return nil, errors.New("VIDEO_STORAGE_FAILED")
	}

	previous, _ := s.videoRepo.GetByProduct(productID)
	created, err := s.videoRepo.Upsert(&models.ProductVideo{
		BusinessID: businessID,
		ProductID:  productID,
		URL:        "/uploads/products/" + productID.String() + "/" + fileName,
		FileName:   filepath.Base(header.Filename),
		MimeType:   mime,
		SizeBytes:  written,
	})
	if err != nil {
		_ = os.Remove(fullPath)
		return nil, errors.New("VIDEO_SAVE_FAILED")
	}
	if previous != nil && previous.URL != created.URL {
		s.removeFile(previous.URL)
	}
	return toVideoResponse(created), nil
}

// Get returns the product's video, or nil when it has none.
func (s *ProductVideoService) Get(userID, businessID, productID uuid.UUID) (*models.ProductVideoResponse, error) {
	if err := s.authorize(userID, businessID, productID); err != nil {
		return nil, err
	}
	v, err := s.videoRepo.GetByProduct(productID)
	if err != nil || v == nil {
		return nil, err
	}
	return toVideoResponse(v), nil
}

// Remove detaches the product's video and deletes the stored file.
func (s *ProductVideoService) Remove(userID, businessID, productID uuid.UUID) error {
	if err := s.authorize(userID, businessID, productID); err != nil {
		return err
	}
	v, err := s.videoRepo.GetByProduct(productID)
	if err != nil {
		return errors.New("VIDEO_DELETE_FAILED")
	}
	if v == nil {
		return errors.New("VIDEO_NOT_FOUND")
	}
	if err := s.videoRepo.DeleteByProduct(productID); err != nil {
		return errors.New("VIDEO_DELETE_FAILED")
	}
	s.removeFile(v.URL)
	return nil
}
