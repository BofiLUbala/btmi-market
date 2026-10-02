package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/lib/pq"
	goredis "github.com/redis/go-redis/v9"
)

// ShopPurgeConfirmation is the word the user must type to confirm.
const ShopPurgeConfirmation = "SUPPRIMER"

const maxShopsPerPurge = 100

// openOrderStatuses mirrors the admin shop list: an order is in progress until
// it is completed, cancelled or rejected.
const openOrderFilter = `status NOT IN ('COMPLETED','CANCELLED','REJECTED')`

// shopHistoryTables hold rows that must outlive the shop (order history,
// payments, commissions, legal records). A shop referenced by any of them is
// kept as a DELETED tombstone instead of losing its row.
var shopHistoryTables = []string{
	"orders", "buyer_payments", "cash_payments", "cash_sessions", "delivery_packages",
	"sale_commissions", "seller_reviews", "verified_transactions",
}

// ShopPurgeActor is who asks for the purge. A seller (UserID set) may only
// delete archived shops of businesses they own or administer; a commerce
// admin (AdminID set) may delete any shop.
type ShopPurgeActor struct {
	UserID    *uuid.UUID
	AdminID   *uuid.UUID
	AdminRole models.AdminRole
	IP        string
	UserAgent string
}

// ShopPurgeService permanently deletes shops, their exclusive products,
// images, stock and staff assignments in a single transaction, then clears
// files and marketplace caches.
type ShopPurgeService struct {
	db        *database.DB
	auditRepo *repository.AuditRepository
	redis     *goredis.Client
	uploadDir string
}

func NewShopPurgeService(db *database.DB, auditRepo *repository.AuditRepository, redis *goredis.Client, uploadDir string) *ShopPurgeService {
	return &ShopPurgeService{db: db, auditRepo: auditRepo, redis: redis, uploadDir: uploadDir}
}

type purgeShopRow struct {
	id, businessID             uuid.UUID
	name, businessName, status string
}

type purgeImage struct {
	productID uuid.UUID
	url       string
}

// queryer is satisfied by both *sql.DB and *sql.Tx.
type queryer interface {
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
}

// uuidArray binds a UUID list as a Postgres array parameter (use with $n::uuid[]).
func uuidArray(ids []uuid.UUID) interface{} {
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = id.String()
	}
	return pq.Array(strs)
}

func normalizeShopIDs(ids []uuid.UUID) ([]uuid.UUID, error) {
	seen := map[uuid.UUID]bool{}
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if id == uuid.Nil || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	if len(out) == 0 {
		return nil, errors.New("NO_SHOPS_SELECTED")
	}
	if len(out) > maxShopsPerPurge {
		return nil, errors.New("TOO_MANY_SHOPS")
	}
	return out, nil
}

// loadShops reads the selected shops (locking them inside a transaction) and
// enforces the actor's permissions on every one of them.
func (s *ShopPurgeService) loadShops(q queryer, ids []uuid.UUID, actor ShopPurgeActor, lock bool) ([]purgeShopRow, error) {
	query := `SELECT s.id, s.business_id, s.name, COALESCE(s.status::text, 'ACTIVE'), b.name
		FROM shops s JOIN businesses b ON b.id = s.business_id WHERE s.id = ANY($1::uuid[])`
	if lock {
		query += ` FOR UPDATE OF s`
	}
	rows, err := q.Query(query, uuidArray(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	shops := make([]purgeShopRow, 0, len(ids))
	for rows.Next() {
		var r purgeShopRow
		if err := rows.Scan(&r.id, &r.businessID, &r.name, &r.status, &r.businessName); err != nil {
			return nil, err
		}
		shops = append(shops, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(shops) != len(ids) {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	for _, sh := range shops {
		if sh.status == string(models.ShopStatusDeleted) {
			return nil, errors.New("SHOP_NOT_FOUND")
		}
		if actor.AdminID != nil {
			continue
		}
		if actor.UserID == nil {
			return nil, errors.New("FORBIDDEN")
		}
		var role string
		err := q.QueryRow(`SELECT role::text FROM business_memberships
			WHERE user_id = $1 AND business_id = $2 AND status = 'ACTIVE'`, *actor.UserID, sh.businessID).Scan(&role)
		if err != nil || (role != string(models.MembershipRoleOwner) && role != string(models.MembershipRoleAdmin)) {
			return nil, errors.New("FORBIDDEN")
		}
		// Sellers delete from the archive only; a suspension is an admin
		// decision a seller must not be able to erase.
		if sh.status != string(models.ShopStatusInactive) {
			return nil, errors.New("SHOP_NOT_ARCHIVED")
		}
	}
	return shops, nil
}

// exclusiveProducts returns the products stocked only in the given shops: no
// other surviving shop holds them, so they leave the marketplace for good.
func exclusiveProducts(q queryer, ids []uuid.UUID) ([]uuid.UUID, error) {
	rows, err := q.Query(`
		SELECT DISTINCT i.product_id FROM inventory i
		WHERE i.shop_id = ANY($1::uuid[])
		  AND NOT EXISTS (
			SELECT 1 FROM inventory o JOIN shops os ON os.id = o.shop_id
			WHERE o.product_id = i.product_id AND NOT (o.shop_id = ANY($1::uuid[])) AND os.status <> 'DELETED')`,
		uuidArray(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// Preview counts what a purge would remove, for the confirmation dialog.
func (s *ShopPurgeService) Preview(shopIDs []uuid.UUID, actor ShopPurgeActor) (*models.ShopPurgePreview, error) {
	ids, err := normalizeShopIDs(shopIDs)
	if err != nil {
		return nil, err
	}
	shops, err := s.loadShops(s.db.DB, ids, actor, false)
	if err != nil {
		return nil, err
	}
	products, err := exclusiveProducts(s.db.DB, ids)
	if err != nil {
		return nil, err
	}
	preview := &models.ShopPurgePreview{ShopCount: len(shops), ProductCount: len(products), BlockedShops: []string{}}
	if len(products) > 0 {
		if err := s.db.QueryRow(`SELECT COUNT(*) FROM product_images WHERE product_id = ANY($1::uuid[])`, uuidArray(products)).Scan(&preview.ImageCount); err != nil {
			return nil, err
		}
	}
	for _, sh := range shops {
		item := models.ShopPurgeShop{ID: sh.id, Name: sh.name, BusinessName: sh.businessName, Status: sh.status}
		_ = s.db.QueryRow(`SELECT COUNT(DISTINCT product_id) FROM inventory WHERE shop_id = $1`, sh.id).Scan(&item.ProductCount)
		_ = s.db.QueryRow(`SELECT COUNT(*) FROM orders WHERE shop_id = $1 AND `+openOrderFilter, sh.id).Scan(&item.OpenOrderCount)
		item.KeepsHistory, err = shopHasHistory(s.db.DB, sh.id)
		if err != nil {
			return nil, err
		}
		if item.OpenOrderCount > 0 {
			preview.BlockedShops = append(preview.BlockedShops, sh.name)
		}
		preview.Shops = append(preview.Shops, item)
	}
	return preview, nil
}

func shopHasHistory(q queryer, shopID uuid.UUID) (bool, error) {
	for _, table := range shopHistoryTables {
		var exists bool
		if err := q.QueryRow(`SELECT EXISTS(SELECT 1 FROM `+table+` WHERE shop_id = $1)`, shopID).Scan(&exists); err != nil {
			return false, err
		}
		if exists {
			return true, nil
		}
	}
	return false, nil
}

// Purge permanently deletes the shops. Every database change happens in one
// transaction: either all selected shops are gone or nothing changed.
func (s *ShopPurgeService) Purge(req *models.ShopPurgeRequest, actor ShopPurgeActor) (*models.ShopPurgeResult, error) {
	if strings.TrimSpace(req.Confirmation) != ShopPurgeConfirmation {
		return nil, errors.New("CONFIRMATION_REQUIRED")
	}
	ids, err := normalizeShopIDs(req.ShopIDs)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	shops, err := s.loadShops(tx, ids, actor, true)
	if err != nil {
		return nil, err
	}
	var open int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM orders WHERE shop_id = ANY($1::uuid[]) AND `+openOrderFilter, uuidArray(ids)).Scan(&open); err != nil {
		return nil, err
	}
	if open > 0 {
		return nil, errors.New("SHOP_HAS_OPEN_ORDERS")
	}

	products, err := exclusiveProducts(tx, ids)
	if err != nil {
		return nil, err
	}
	images, err := productImages(tx, products)
	if err != nil {
		return nil, err
	}

	// Order lines keep a snapshot of the product image. Those files move to
	// order-history storage so past orders stay illustrated while the
	// product directory (scanned by visual search) disappears.
	copied, err := s.preserveOrderImages(tx, images)
	if err != nil {
		removeFiles(copied)
		return nil, err
	}

	result := &models.ShopPurgeResult{DeletedProducts: len(products), DeletedImages: len(images)}
	shopArg, productArg := uuidArray(ids), uuidArray(products)
	steps := []struct {
		stmt string
		arg  interface{}
	}{
		// review_history -> seller_reviews is NO ACTION; product reviews cascade with the product.
		{`DELETE FROM review_history WHERE review_id IN (SELECT id FROM seller_reviews WHERE product_id = ANY($1::uuid[]))`, productArg},
		{`DELETE FROM seller_reviews WHERE product_id = ANY($1::uuid[])`, productArg},
		// Detach history rows before the product goes: letting ON DELETE SET NULL
		// do it races the variant cascade and fails the variant FK check.
		{`UPDATE order_lines SET product_id = NULL, variant_id = NULL WHERE product_id = ANY($1::uuid[])`, productArg},
		{`UPDATE product_handover_verifications SET product_id = NULL, variant_id = NULL WHERE product_id = ANY($1::uuid[])`, productArg},
		{`DELETE FROM product_images WHERE product_id = ANY($1::uuid[])`, productArg},
		// Cascades to variants, images, inventory, stock movements, QR codes,
		// search documents and review aggregates of those products.
		{`DELETE FROM products WHERE id = ANY($1::uuid[])`, productArg},
		// What remains of the shops' own stock and staff.
		{`DELETE FROM inventory WHERE shop_id = ANY($1::uuid[])`, shopArg},
		{`DELETE FROM stock_movements WHERE shop_id = ANY($1::uuid[])`, shopArg},
		{`DELETE FROM stock_receipts WHERE shop_id = ANY($1::uuid[])`, shopArg},
		{`DELETE FROM employee_shop_assignments WHERE shop_id = ANY($1::uuid[])`, shopArg},
		{`DELETE FROM shop_review_aggregates WHERE shop_id = ANY($1::uuid[])`, shopArg},
	}
	for i, step := range steps {
		if _, err := tx.Exec(step.stmt, step.arg); err != nil {
			removeFiles(copied)
			return nil, fmt.Errorf("deletion step %d failed: %w", i+1, err)
		}
	}

	for _, sh := range shops {
		keep, err := shopHasHistory(tx, sh.id)
		if err != nil {
			removeFiles(copied)
			return nil, err
		}
		if keep {
			// Tombstone: identity kept for receipts, everything else wiped.
			_, err = tx.Exec(`UPDATE shops SET status = 'DELETED', phone = '', landmark = '',
				supports_shop_delivery = false, shop_delivery_fee = 0,
				supports_partner_delivery = false, partner_delivery_fee = 0, partner_delivery_provider = '',
				delivery_city = '', delivery_address = '', updated_at = NOW()
				WHERE id = $1`, sh.id)
			result.HistoryKeptShops++
		} else {
			_, err = tx.Exec(`DELETE FROM shops WHERE id = $1`, sh.id)
		}
		if err != nil {
			removeFiles(copied)
			return nil, fmt.Errorf("shop deletion failed: %w", err)
		}
		result.DeletedShops++
	}

	if err := tx.Commit(); err != nil {
		removeFiles(copied)
		return nil, err
	}

	// The data is gone; files and caches are cleaned up best effort.
	s.removeProductFiles(products, images)
	s.clearCaches(shops, products)
	s.audit(shops, products, len(images), req.Reason, actor)
	return result, nil
}

func productImages(q queryer, products []uuid.UUID) ([]purgeImage, error) {
	if len(products) == 0 {
		return nil, nil
	}
	rows, err := q.Query(`SELECT product_id, url FROM product_images WHERE product_id = ANY($1::uuid[])`, uuidArray(products))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []purgeImage
	for rows.Next() {
		var img purgeImage
		if err := rows.Scan(&img.productID, &img.url); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

// localUploadPath maps a /uploads/... URL to its file, refusing anything that
// would escape the upload directory.
func (s *ShopPurgeService) localUploadPath(url string) (string, bool) {
	if !strings.HasPrefix(url, "/uploads/") {
		return "", false
	}
	rel := path.Clean(strings.TrimPrefix(url, "/uploads/"))
	if rel == "." || strings.HasPrefix(rel, "..") {
		return "", false
	}
	return filepath.Join(s.uploadDir, filepath.FromSlash(rel)), true
}

// preserveOrderImages copies every image still shown by an order line to
// uploads/order-history and repoints those lines. Returns the copies made so
// a failed purge can remove them.
func (s *ShopPurgeService) preserveOrderImages(tx *sql.Tx, images []purgeImage) ([]string, error) {
	var copied []string
	for _, img := range images {
		var used bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM order_lines WHERE image_url = $1)`, img.url).Scan(&used); err != nil {
			return copied, err
		}
		if !used {
			continue
		}
		src, ok := s.localUploadPath(img.url)
		if !ok {
			continue
		}
		name := img.productID.String() + "-" + path.Base(img.url)
		dst := filepath.Join(s.uploadDir, "order-history", name)
		if err := copyFile(src, dst); err != nil {
			if os.IsNotExist(err) {
				continue // nothing on disk to keep
			}
			return copied, fmt.Errorf("IMAGE_ARCHIVE_FAILED: %w", err)
		}
		copied = append(copied, dst)
		if _, err := tx.Exec(`UPDATE order_lines SET image_url = $1 WHERE image_url = $2`, "/uploads/order-history/"+name, img.url); err != nil {
			return copied, err
		}
	}
	return copied, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(dst)
		return err
	}
	return out.Close()
}

func removeFiles(paths []string) {
	for _, p := range paths {
		_ = os.Remove(p)
	}
}

// removeProductFiles deletes each image file, then the per-product upload
// directory so visual search stops matching the product.
func (s *ShopPurgeService) removeProductFiles(products []uuid.UUID, images []purgeImage) {
	for _, img := range images {
		if p, ok := s.localUploadPath(img.url); ok {
			if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
				log.Printf("shop purge: could not remove %s: %v", p, err)
			}
		}
	}
	for _, id := range products {
		dir := filepath.Join(s.uploadDir, "products", id.String())
		if err := os.RemoveAll(dir); err != nil {
			log.Printf("shop purge: could not remove %s: %v", dir, err)
		}
	}
}

// clearCaches drops the shops and products from every Redis structure the
// marketplace reads: category rankings, similar-product sets and the home feed.
// No ranking recalculation is queued: that job re-adds a shop to every
// category of its business whatever the shop's status.
func (s *ShopPurgeService) clearCaches(shops []purgeShopRow, products []uuid.UUID) {
	if s.redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		shopMembers := make([]interface{}, 0, len(shops))
		for _, sh := range shops {
			shopMembers = append(shopMembers, sh.id.String())
		}
		productMembers := make([]interface{}, 0, len(products))
		for _, id := range products {
			productMembers = append(productMembers, id.String())
			s.redis.Del(ctx, fmt.Sprintf("marketplace:similar:product:%s", id))
		}
		s.zremMatching(ctx, "marketplace:category:*:shops", shopMembers)
		s.zremMatching(ctx, "marketplace:similar:product:*", productMembers)
		s.redis.Del(ctx, redisKeyHomeFeed)
	}
}

func (s *ShopPurgeService) zremMatching(ctx context.Context, pattern string, members []interface{}) {
	if len(members) == 0 {
		return
	}
	iter := s.redis.Scan(ctx, 0, pattern, 200).Iterator()
	for iter.Next(ctx) {
		s.redis.ZRem(ctx, iter.Val(), members...)
	}
	if err := iter.Err(); err != nil {
		log.Printf("shop purge: cache scan %s failed: %v", pattern, err)
	}
}

func (s *ShopPurgeService) audit(shops []purgeShopRow, products []uuid.UUID, images int, reason string, actor ShopPurgeActor) {
	for _, sh := range shops {
		detail := map[string]interface{}{
			"name": sh.name, "business": sh.businessName, "status": sh.status,
			"products_deleted": len(products), "images_deleted": images,
		}
		if actor.AdminID == nil {
			log.Printf("shop purge: seller %s permanently deleted shop %s (%s)", actor.UserID, sh.id, sh.name)
			continue
		}
		if s.auditRepo == nil {
			continue
		}
		old, _ := json.Marshal(detail)
		oldRaw := json.RawMessage(old)
		why := strings.TrimSpace(reason)
		if why == "" {
			why = "Suppression définitive"
		}
		ip, ua := actor.IP, actor.UserAgent
		_ = s.auditRepo.Record(&models.AdminAuditLog{
			ActorAdminID: *actor.AdminID,
			ActorRole:    actor.AdminRole,
			Action:       "SHOP_PERMANENTLY_DELETED",
			TargetType:   "SHOP",
			TargetID:     sh.id.String(),
			Reason:       why,
			OldValue:     &oldRaw,
			IPAddress:    &ip,
			UserAgent:    &ua,
		})
	}
}

// ShopPurgeError maps a purge failure to an HTTP status and a message the
// user can act on.
func ShopPurgeError(err error) (int, string, string) {
	code := err.Error()
	switch code {
	case "CONFIRMATION_REQUIRED":
		return 400, code, "Saisissez SUPPRIMER pour confirmer la suppression définitive."
	case "NO_SHOPS_SELECTED":
		return 400, code, "Aucune boutique sélectionnée."
	case "TOO_MANY_SHOPS":
		return 400, code, fmt.Sprintf("Au plus %d boutiques peuvent être supprimées en une fois.", maxShopsPerPurge)
	case "SHOP_NOT_FOUND":
		return 404, code, "Une des boutiques sélectionnées n'existe plus ou a déjà été supprimée."
	case "FORBIDDEN":
		return 403, code, "Vous ne pouvez supprimer que les boutiques de votre propre entreprise."
	case "SHOP_NOT_ARCHIVED":
		return 409, code, "Seule une boutique archivée peut être supprimée définitivement."
	case "SHOP_HAS_OPEN_ORDERS":
		return 409, code, "Des commandes sont encore en cours dans cette sélection. Terminez-les ou annulez-les avant de supprimer."
	}
	return 500, "SHOP_PURGE_FAILED", "La suppression a échoué et rien n'a été supprimé. Réessayez."
}
