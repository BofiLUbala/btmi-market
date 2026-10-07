package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Live presence: everyone who has the site or the app open right now, signed in
// or not. Clients send a heartbeat every PresenceHeartbeatSeconds with an
// anonymous per-device id and the page they are on; nothing is written to
// Postgres and every key expires on its own, so presence is always "now".
const (
	PresenceHeartbeatSeconds = 30
	// A visitor counts as present while their last heartbeat is this recent
	// (two missed beats plus network slack).
	presenceWindow     = 75 * time.Second
	presenceKeyTTL     = 10 * time.Minute
	presenceKnownTTL   = 90 * 24 * time.Hour
	presenceMaxTracked = 5000
	presenceIPPerMin   = 600 // generous: mobile carriers share one IP among many phones

	presenceIndexKey = "presence:seen"
	// An account's last heartbeat (any device), read by the sessions view.
	presenceUserTTL = 7 * 24 * time.Hour
)

func userSeenKey(id string) string { return "presence:user:" + id }

var (
	ErrPresenceInvalid     = errors.New("PRESENCE_INVALID")
	ErrPresenceRateLimited = errors.New("PRESENCE_RATE_LIMITED")
)

// PresenceHeartbeat is what a client sends.
type PresenceHeartbeat struct {
	VisitorID string `json:"visitor_id" binding:"required"`
	Path      string `json:"path"`
	Platform  string `json:"platform"`
	// HasSession: the device still holds a session (its access token may just
	// have expired while idle). Only a hint; identity comes from the last
	// authenticated heartbeat of this device.
	HasSession bool `json:"has_session"`
	// Background: the tab is open but not the one being looked at.
	Background bool `json:"background"`
}

// PresenceVisitor is one device present right now.
type PresenceVisitor struct {
	VisitorID string `json:"visitor_id"`
	// Status: SIGNED_IN (a live session), KNOWN_SIGNED_OUT (this device was last
	// used by an account that is not signed in now) or ANONYMOUS.
	Status      string    `json:"status"`
	UserID      string    `json:"user_id,omitempty"`
	Email       string    `json:"email,omitempty"`
	Name        string    `json:"name,omitempty"`
	Role        string    `json:"role,omitempty"`
	Path        string    `json:"path"`
	Platform    string    `json:"platform"`
	Background  bool      `json:"background"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	FirstSeenAt time.Time `json:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

type PresenceSummary struct {
	Total          int            `json:"total"`
	SignedIn       int            `json:"signed_in"`
	KnownSignedOut int            `json:"known_signed_out"`
	Anonymous      int            `json:"anonymous"`
	ByPlatform     map[string]int `json:"by_platform"`
	ByPage         map[string]int `json:"by_page"`
}

type PresenceService struct {
	redis *redis.Client
	db    *sql.DB
}

func NewPresenceService(redisClient *redis.Client, db *sql.DB) *PresenceService {
	return &PresenceService{redis: redisClient, db: db}
}

func visitorKey(id string) string { return "presence:v:" + id }
func knownKey(id string) string   { return "presence:known:" + id }

// cleanPath keeps only the route: query strings and fragments can carry tokens
// (activation, password reset) and never reach the monitoring view.
func cleanPath(p string) string {
	if i := strings.IndexAny(p, "?#"); i >= 0 {
		p = p[:i]
	}
	p = strings.TrimSpace(p)
	if p == "" || !strings.HasPrefix(p, "/") {
		p = "/"
	}
	if len(p) > 200 {
		p = p[:200]
	}
	return p
}

// Heartbeat records that visitorID is on path now. userID is set when the
// request carried a valid access token.
func (s *PresenceService) Heartbeat(ctx context.Context, hb PresenceHeartbeat, userID *uuid.UUID, ip, ua string) error {
	if s.redis == nil {
		return nil
	}
	vid, err := uuid.Parse(strings.TrimSpace(hb.VisitorID))
	if err != nil {
		return ErrPresenceInvalid
	}
	platform := strings.ToLower(strings.TrimSpace(hb.Platform))
	if platform != "android" && platform != "ios" {
		platform = "web"
	}
	if len(ua) > 300 {
		ua = ua[:300]
	}

	// A public endpoint: bound what one address can write, and the total size.
	rateKey := fmt.Sprintf("presence:rate:%s:%d", ip, time.Now().Unix()/60)
	n, err := s.redis.Incr(ctx, rateKey).Result()
	if err != nil {
		return err
	}
	if n == 1 {
		s.redis.Expire(ctx, rateKey, 2*time.Minute)
	}
	if n > presenceIPPerMin {
		return ErrPresenceRateLimited
	}
	id := vid.String()
	key := visitorKey(id)
	exists, _ := s.redis.Exists(ctx, key).Result()
	if exists == 0 {
		if count, _ := s.redis.ZCard(ctx, presenceIndexKey).Result(); count >= presenceMaxTracked {
			s.prune(ctx)
			if count, _ = s.redis.ZCard(ctx, presenceIndexKey).Result(); count >= presenceMaxTracked {
				return ErrPresenceRateLimited
			}
		}
	}

	now := time.Now()
	fields := map[string]interface{}{
		"path": cleanPath(hb.Path), "platform": platform, "ip": ip, "ua": ua,
		"last_seen": now.UnixMilli(), "user_id": "", "has_session": "0",
	}
	if hb.HasSession {
		fields["has_session"] = "1"
	}
	fields["background"] = "0"
	if hb.Background {
		fields["background"] = "1"
	}
	if userID != nil {
		fields["user_id"] = userID.String()
		// The account is active right now: the Direction's sessions view
		// reads this instead of the last token rotation.
		s.redis.Set(ctx, userSeenKey(userID.String()), now.UnixMilli(), presenceUserTTL)
		// Remember which account last used this device, to recognise it later
		// while signed out.
		s.redis.Set(ctx, knownKey(id), userID.String(), presenceKnownTTL)
	}
	pipe := s.redis.TxPipeline()
	pipe.HSetNX(ctx, key, "first_seen", now.UnixMilli())
	pipe.HSet(ctx, key, fields)
	pipe.Expire(ctx, key, presenceKeyTTL)
	pipe.ZAdd(ctx, presenceIndexKey, redis.Z{Score: float64(now.UnixMilli()), Member: id})
	_, err = pipe.Exec(ctx)
	return err
}

// Leave removes a visitor at once (tab closed, app sent to background).
func (s *PresenceService) Leave(ctx context.Context, visitorID string) error {
	if s.redis == nil {
		return nil
	}
	vid, err := uuid.Parse(strings.TrimSpace(visitorID))
	if err != nil {
		return ErrPresenceInvalid
	}
	pipe := s.redis.TxPipeline()
	pipe.ZRem(ctx, presenceIndexKey, vid.String())
	pipe.Del(ctx, visitorKey(vid.String()))
	_, err = pipe.Exec(ctx)
	return err
}

func (s *PresenceService) prune(ctx context.Context) {
	cutoff := time.Now().Add(-presenceWindow).UnixMilli()
	s.redis.ZRemRangeByScore(ctx, presenceIndexKey, "-inf", strconv.FormatInt(cutoff, 10))
}

type presenceAccount struct{ email, name, role string }

// List returns everyone present now, most recent first, with a summary.
func (s *PresenceService) List(ctx context.Context) ([]PresenceVisitor, PresenceSummary, error) {
	summary := PresenceSummary{ByPlatform: map[string]int{}, ByPage: map[string]int{}}
	out := []PresenceVisitor{}
	if s.redis == nil {
		return out, summary, nil
	}
	s.prune(ctx)
	ids, err := s.redis.ZRevRange(ctx, presenceIndexKey, 0, -1).Result()
	if err != nil {
		return nil, summary, err
	}

	accounts := map[string]*presenceAccount{}
	account := func(userID string) *presenceAccount {
		if a, ok := accounts[userID]; ok {
			return a
		}
		var a presenceAccount
		if err := s.db.QueryRowContext(ctx, `SELECT email, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), LOWER(account_type::text) FROM users WHERE id=$1`, userID).
			Scan(&a.email, &a.name, &a.role); err != nil {
			accounts[userID] = nil
			return nil
		}
		accounts[userID] = &a
		return &a
	}

	for _, id := range ids {
		h, err := s.redis.HGetAll(ctx, visitorKey(id)).Result()
		if err != nil || len(h) == 0 {
			s.redis.ZRem(ctx, presenceIndexKey, id)
			continue
		}
		v := PresenceVisitor{VisitorID: id, Path: h["path"], Platform: h["platform"], IPAddress: h["ip"], UserAgent: h["ua"], Status: "ANONYMOUS", Background: h["background"] == "1"}
		if ms, err := strconv.ParseInt(h["last_seen"], 10, 64); err == nil {
			v.LastSeenAt = time.UnixMilli(ms)
		}
		if ms, err := strconv.ParseInt(h["first_seen"], 10, 64); err == nil {
			v.FirstSeenAt = time.UnixMilli(ms)
		}
		userID := h["user_id"]
		if userID != "" {
			v.Status = "SIGNED_IN"
		} else if known, _ := s.redis.Get(ctx, knownKey(id)).Result(); known != "" {
			userID = known
			v.Status = "KNOWN_SIGNED_OUT"
			if h["has_session"] == "1" {
				// Signed in, only idle past the access-token lifetime.
				v.Status = "SIGNED_IN"
			}
		}
		if userID != "" {
			if a := account(userID); a != nil {
				v.UserID, v.Email, v.Name, v.Role = userID, a.email, a.name, a.role
			} else {
				v.Status = "ANONYMOUS"
			}
		}

		switch v.Status {
		case "SIGNED_IN":
			summary.SignedIn++
		case "KNOWN_SIGNED_OUT":
			summary.KnownSignedOut++
		default:
			summary.Anonymous++
		}
		summary.Total++
		summary.ByPlatform[v.Platform]++
		summary.ByPage[pageGroup(v.Path)]++
		out = append(out, v)
	}
	return out, summary, nil
}

// pageGroup folds a path into the section of the site it belongs to.
func pageGroup(p string) string {
	switch {
	case p == "/" || p == "/index":
		return "home"
	case strings.HasPrefix(p, "/product"):
		return "product"
	case strings.HasPrefix(p, "/shop"), strings.HasPrefix(p, "/boutique"):
		return "shop"
	case strings.HasPrefix(p, "/search"), strings.HasPrefix(p, "/categor"):
		return "browse"
	case strings.HasPrefix(p, "/cart"), strings.HasPrefix(p, "/checkout"):
		return "checkout"
	case strings.HasPrefix(p, "/seller"), strings.HasPrefix(p, "/employee"):
		return "seller"
	case strings.HasPrefix(p, "/courier"), strings.HasPrefix(p, "/livreur"):
		return "courier"
	case strings.HasPrefix(p, "/orders"), strings.HasPrefix(p, "/account"), strings.HasPrefix(p, "/points"),
		strings.HasPrefix(p, "/favorites"), strings.HasPrefix(p, "/notifications"), strings.HasPrefix(p, "/reviews"),
		strings.HasPrefix(p, "/profile"), strings.HasPrefix(p, "/purchases"):
		return "account"
	case strings.HasPrefix(p, "/login"), strings.HasPrefix(p, "/register"), strings.HasPrefix(p, "/auth"),
		strings.HasPrefix(p, "/activate"), strings.HasPrefix(p, "/forgot"), strings.HasPrefix(p, "/reset"):
		return "auth"
	default:
		return "other"
	}
}

// UsersLastSeen returns, for each account that sent a heartbeat in the last
// week, when it last did (from any device).
func (s *PresenceService) UsersLastSeen(ctx context.Context, ids []uuid.UUID) map[uuid.UUID]time.Time {
	out := map[uuid.UUID]time.Time{}
	if s == nil || s.redis == nil || len(ids) == 0 {
		return out
	}
	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		keys := make([]string, 0, end-start)
		for _, id := range ids[start:end] {
			keys = append(keys, userSeenKey(id.String()))
		}
		vals, err := s.redis.MGet(ctx, keys...).Result()
		if err != nil {
			continue
		}
		for i, v := range vals {
			str, ok := v.(string)
			if !ok {
				continue
			}
			if ms, err := strconv.ParseInt(str, 10, 64); err == nil {
				out[ids[start+i]] = time.UnixMilli(ms)
			}
		}
	}
	return out
}
