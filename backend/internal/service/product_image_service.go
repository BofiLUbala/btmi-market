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

const maxProductImageBytes = 5 << 20 // 5 MB

var allowedImageTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

type ProductImageService struct {
	imageRepo      *repository.ProductImageRepository
	productRepo    *repository.ProductRepository
	membershipRepo *repository.MembershipRepository
	uploadDir      string
}

func NewProductImageService(
	imageRepo *repository.ProductImageRepository,
	productRepo *repository.ProductRepository,
	membershipRepo *repository.MembershipRepository,
	uploadDir string,
) *ProductImageService {
	return &ProductImageService{
		imageRepo:      imageRepo,
		productRepo:    productRepo,
		membershipRepo: membershipRepo,
		uploadDir:      uploadDir,
	}
}

func (s *ProductImageService) toResponse(img *models.ProductImage) models.ProductImageResponse {
	return models.ProductImageResponse{
		ID:        img.ID,
		ProductID: img.ProductID,
		URL:       img.URL,
		FileName:  img.FileName,
		SortOrder: img.SortOrder,
		IsPrimary: img.IsPrimary,
		CreatedAt: img.CreatedAt,
	}
}

func (s *ProductImageService) requireMembership(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *ProductImageService) Upload(userID, businessID, productID uuid.UUID, header *multipart.FileHeader, makePrimary bool) (*models.ProductImageResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	product, err := s.productRepo.GetByID(productID)
	if err != nil || product == nil || product.BusinessID != businessID {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if header.Size > maxProductImageBytes {
		return nil, errors.New("IMAGE_TOO_LARGE")
	}

	ext, ok := allowedImageTypes[header.Header.Get("Content-Type")]
	if !ok {
		return nil, errors.New("INVALID_IMAGE_TYPE")
	}

	count, err := s.imageRepo.CountByProduct(productID)
	if err != nil {
		return nil, err
	}
	const maxImagesPerProduct = 10
	if count >= maxImagesPerProduct {
		return nil, errors.New("IMAGE_LIMIT_REACHED")
	}

	// First image uploaded becomes the primary image automatically.
	isPrimary := makePrimary || count == 0

	src, err := header.Open()
	if err != nil {
		return nil, errors.New("IMAGE_READ_FAILED")
	}
	defer src.Close()

	dir := filepath.Join(s.uploadDir, "products", productID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, errors.New("IMAGE_STORAGE_FAILED")
	}

	fileName := fmt.Sprintf("%s.%s", uuid.NewString(), ext)
	fullPath := filepath.Join(dir, fileName)
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, errors.New("IMAGE_STORAGE_FAILED")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, io.LimitReader(src, maxProductImageBytes+1)); err != nil {
		os.Remove(fullPath)
		return nil, errors.New("IMAGE_STORAGE_FAILED")
	}

	maxOrder, err := s.imageRepo.MaxSortOrder(productID)
	if err != nil {
		maxOrder = count
	}

	img := &models.ProductImage{
		BusinessID: businessID,
		ProductID:  productID,
		URL:        "/uploads/products/" + productID.String() + "/" + fileName,
		FileName:   filepath.Base(header.Filename),
		SortOrder:  maxOrder + 1,
		IsPrimary:  isPrimary,
	}

	created, err := s.imageRepo.Create(img)
	if err != nil {
		os.Remove(fullPath)
		return nil, errors.New("IMAGE_SAVE_FAILED")
	}

	if created.IsPrimary && count > 0 {
		if err := s.imageRepo.ClearPrimary(productID, created.ID); err != nil {
			return nil, errors.New("IMAGE_SAVE_FAILED")
		}
	}

	resp := s.toResponse(created)
	return &resp, nil
}

func (s *ProductImageService) List(userID, businessID, productID uuid.UUID) ([]models.ProductImageResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	product, err := s.productRepo.GetByID(productID)
	if err != nil || product == nil || product.BusinessID != businessID {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	images, err := s.imageRepo.ListByProduct(productID)
	if err != nil {
		return nil, err
	}

	responses := make([]models.ProductImageResponse, 0, len(images))
	for _, img := range images {
		responses = append(responses, s.toResponse(img))
	}
	return responses, nil
}

func (s *ProductImageService) Delete(userID, businessID, productID, imageID uuid.UUID) error {
	if err := s.requireMembership(userID, businessID); err != nil {
		return err
	}

	img, err := s.imageRepo.GetByID(imageID)
	if err != nil || img == nil || img.BusinessID != businessID || img.ProductID != productID {
		return errors.New("IMAGE_NOT_FOUND")
	}

	wasPrimary := img.IsPrimary

	if err := s.imageRepo.Delete(imageID); err != nil {
		return errors.New("IMAGE_DELETE_FAILED")
	}

	// Remove the file from disk (best effort).
	clean := strings.TrimPrefix(img.URL, "/uploads/")
	os.Remove(filepath.Join(s.uploadDir, filepath.FromSlash(clean)))

	if wasPrimary {
		remaining, err := s.imageRepo.ListByProduct(productID)
		if err == nil && len(remaining) > 0 {
			s.imageRepo.ClearPrimary(productID, remaining[0].ID)
			s.imageRepo.SetPrimary(remaining[0].ID)
		}
	}

	return nil
}
