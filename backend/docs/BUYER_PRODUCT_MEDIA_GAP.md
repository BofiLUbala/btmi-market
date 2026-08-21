# BUYER PRODUCT MEDIA GAP ANALYSIS

**Date**: 2026-08-21
**Scope**: BTMI Market Web App — Buyer-facing product detail page media support

---

## Summary

| Capability | Status | Notes |
|------------|--------|-------|
| Product images (multiple) | **MISSING** | No `image_url` / `images` fields in `PublicProductDetailResponse` or `PublicProductResponse` |
| Variant-specific images | **MISSING** | No image fields in `PublicVariantDetailResponse` |
| Image upload endpoint | **MISSING** | No `POST /api/v1/seller/products/:id/images` or similar |
| Image ordering / primary | **MISSING** | N/A |
| CDN / signed URLs | **N/A** | Not applicable without storage |

**Overall classification**: **MISSING** — Backend does not persist or serve product/variant images.

---

## Current Backend Schema (as of migration 028)

- `products` table: no image columns
- `product_variants` table: no image columns
- `PublicProductDetailResponse` (marketplace.go:124): no image fields
- `PublicVariantDetailResponse` (marketplace.go:152): no image fields
- `PublicProductResponse` (marketplace.go:9): no image fields
- No migration adds image columns
- No handler/upload endpoint for images exists in `internal/handlers/marketplace` or `seller`

---

## Frontend Mitigation (Implemented)

- `Gallery` component (`src/components/ui/Gallery.tsx`) renders a deterministic initials placeholder when `images` array is empty
- Component accepts `images: ProductImage[]` for future backend support — zero code change needed when API adds images
- Thumbnail strip, main image swap, loading/error states, responsive sizing implemented
- Placeholder uses consistent hue derived from product name for visual consistency

---

## Recommended Backend Extension (When Prioritized)

1. **Schema**: Add `images JSONB` column to `products` and `product_variants` (array of `{url, alt, ordering, is_primary}`)
2. **Migration**: `ALTER TABLE products ADD COLUMN images JSONB DEFAULT '[]'; ALTER TABLE product_variants ADD COLUMN images JSONB DEFAULT '[]';`
3. **Models**: Extend `PublicProductDetailResponse`, `PublicVariantDetailResponse`, `PublicProductResponse` with `Images []ProductImage`
4. **Seller API**: `POST /api/v1/seller/products/:id/images` (multipart), `PATCH /api/v1/seller/products/:id/images/:imageId` (reorder, set primary, alt), `DELETE /api/v1/seller/products/:id/images/:imageId`
5. **Storage**: S3-compatible (MinIO) or local filesystem with signed URLs; serve via `/api/v1/media/...` or CDN
6. **Validation**: Max 10 images per product/variant, max 5 MB each, allowed types: JPEG, PNG, WebP
7. **Variant inheritance**: If variant has no images, fall back to product images

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Buyer cannot see product appearance | High (conversion) | Certain (current) | Gallery placeholder + clear "No image" messaging |
| Seller cannot showcase products | High | Certain | Document gap; prioritize backend work |
| Inconsistent UX when images added | Medium | Low | Gallery component already abstracts image source |

---

## Decision

**Do not fake persistence** (per project rules). Gallery component is production-ready with placeholder. Backend image support tracked as separate epic.