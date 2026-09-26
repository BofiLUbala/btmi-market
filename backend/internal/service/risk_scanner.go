package service

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// RiskScanner turns live marketplace state into the risk events the Finance /
// Trust dashboard triages. Every rule reads its threshold from global_configs,
// so the values an admin edits on the Global Config screen take effect on the
// next scan. A rule never raises a second event for a target that already has
// an open one, or one resolved in the last 24 hours.
type RiskScanner struct {
	db *sql.DB
}

func NewRiskScanner(db *sql.DB) *RiskScanner { return &RiskScanner{db: db} }

type riskRule struct {
	code, eventType, severity, targetType string
	// query returns (target_id uuid, details jsonb) rows; $1 is the rule's threshold.
	query     string
	configKey string
	fallback  string
}

var riskRules = []riskRule{
	{
		code: "STUCK_ORDER", eventType: "ORDER_STUCK", severity: "WARNING", targetType: "ORDER",
		configKey: "STUCK_ORDER_THRESHOLD_HOURS", fallback: "48",
		query: `SELECT o.id, jsonb_build_object('order_number', o.order_number, 'status', o.status,
				'hours_without_progress', ROUND(EXTRACT(EPOCH FROM NOW() - o.updated_at) / 3600))
			FROM orders o
			WHERE o.status NOT IN ('COMPLETED','CANCELLED','REJECTED','DELIVERED')
			  AND o.updated_at < NOW() - make_interval(secs => ($1::text)::numeric * 3600)`,
	},
	{
		code: "REPEATED_DISPUTES", eventType: "SELLER_DISPUTES", severity: "CRITICAL", targetType: "BUSINESS",
		configKey: "DEFAULT_DISPUTE_THRESHOLD", fallback: "3",
		query: `SELECT c.business_id, jsonb_build_object('open_cases', COUNT(*), 'business', MAX(b.name))
			FROM cases c JOIN businesses b ON b.id = c.business_id
			WHERE c.business_id IS NOT NULL AND c.status IN ('OPEN','UNDER_REVIEW','WAITING_FOR_ADMIN')
			GROUP BY c.business_id HAVING COUNT(*) >= ($1::text)::int`,
	},
	{
		code: "HIGH_CANCELLATION_RATE", eventType: "SELLER_CANCELLATIONS", severity: "WARNING", targetType: "BUSINESS",
		configKey: "RISK_ALERT_THRESHOLD", fallback: "75",
		query: `SELECT o.business_id, jsonb_build_object('orders_30d', COUNT(*),
				'cancelled_30d', COUNT(*) FILTER (WHERE o.status IN ('CANCELLED','REJECTED')),
				'cancellation_rate', ROUND(100.0 * COUNT(*) FILTER (WHERE o.status IN ('CANCELLED','REJECTED')) / COUNT(*), 1))
			FROM orders o WHERE o.created_at > NOW() - INTERVAL '30 days'
			GROUP BY o.business_id
			HAVING COUNT(*) >= 5 AND 100.0 * COUNT(*) FILTER (WHERE o.status IN ('CANCELLED','REJECTED')) / COUNT(*) >= ($1::text)::numeric`,
	},
	{
		code: "NEGATIVE_AVAILABLE_STOCK", eventType: "STOCK_INTEGRITY", severity: "CRITICAL", targetType: "INVENTORY",
		query: `SELECT i.id, jsonb_build_object('shop_id', i.shop_id, 'product_id', i.product_id,
				'quantity', i.quantity, 'reserved_quantity', i.reserved_quantity)
			FROM inventory i WHERE i.quantity < 0 OR i.reserved_quantity > i.quantity`,
	},
	{
		code: "SETTLED_WITHOUT_CONFIRMATION", eventType: "PAYMENT_ANOMALY", severity: "WARNING", targetType: "PAYMENT",
		query: `SELECT bp.id, jsonb_build_object('order_id', bp.order_id, 'status', bp.status, 'amount', bp.cash_due, 'method', bp.payment_method)
			FROM buyer_payments bp
			WHERE bp.status IN ('PAID','VERIFIED') AND bp.confirmation_actor IS NULL`,
	},
}

// Scan evaluates every rule once and returns how many new events it raised.
func (s *RiskScanner) Scan(ctx context.Context) (int, error) {
	raised := 0
	for _, rule := range riskRules {
		threshold := rule.fallback
		if threshold == "" {
			threshold = "0"
		}
		if rule.configKey != "" {
			var v string
			if err := s.db.QueryRowContext(ctx, `SELECT value FROM global_configs WHERE key = $1`, rule.configKey).Scan(&v); err == nil && v != "" {
				threshold = v
			}
		}
		res, err := s.db.ExecContext(ctx, `
			INSERT INTO risk_events (event_type, severity, target_type, target_id, rule_code, details, status)
			SELECT $2::text, $3::text, $4::text, hit.id, $5::text, hit.details || jsonb_build_object('threshold', $1::text), 'OPEN'
			FROM (`+rule.query+`) AS hit(id, details)
			WHERE NOT EXISTS (
				SELECT 1 FROM risk_events re
				WHERE re.rule_code = $5::text AND re.target_id = hit.id
				  AND (re.status IN ('OPEN','INVESTIGATING') OR re.resolved_at > NOW() - INTERVAL '24 hours')
			)`, threshold, rule.eventType, rule.severity, rule.targetType, rule.code)
		if err != nil {
			log.Printf("[risk] rule %s failed: %v", rule.code, err)
			continue
		}
		n, _ := res.RowsAffected()
		raised += int(n)
	}
	return raised, nil
}

// Start scans immediately and then on every interval until ctx is cancelled.
func (s *RiskScanner) Start(ctx context.Context, every time.Duration) {
	go func() {
		ticker := time.NewTicker(every)
		defer ticker.Stop()
		for {
			if n, err := s.Scan(ctx); err == nil && n > 0 {
				log.Printf("[risk] raised %d new risk event(s)", n)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}
