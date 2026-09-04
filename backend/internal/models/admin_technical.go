package models

import (
	"time"

	"github.com/google/uuid"
)

type ServiceHealthItem struct {
	ServiceName         string     `json:"service_name"`
	Status              string     `json:"status"` // HEALTHY, DEGRADED, DOWN, UNKNOWN
	LatencyMS           int        `json:"latency_ms"`
	LastCheck           time.Time  `json:"last_check"`
	LastFailure         *time.Time `json:"last_failure,omitempty"`
	ErrorMessageSummary string     `json:"error_message_summary,omitempty"`
	UptimePercent       float64    `json:"uptime_percent"`
	DependencyStatus    string     `json:"dependency_status"`
}

type GlobalSystemHealth struct {
	OverallStatus string              `json:"overall_status"`
	Services      []ServiceHealthItem `json:"services"`
	CheckedAt     time.Time           `json:"checked_at"`
}

type EndpointMetric struct {
	Endpoint     string  `json:"endpoint"`
	Method       string  `json:"method"`
	Count        int64   `json:"count"`
	AvgLatencyMS float64 `json:"avg_latency_ms"`
	ErrorCount   int64   `json:"error_count"`
}

type APIErrorLog struct {
	Timestamp     time.Time `json:"timestamp"`
	Endpoint      string    `json:"endpoint"`
	Method        string    `json:"method"`
	StatusCode    int       `json:"status_code"`
	ErrorCategory string    `json:"error_category"`
	CorrelationID string    `json:"correlation_id,omitempty"`
}

type APIMetricsSummary struct {
	RequestsPerMinute float64          `json:"requests_per_minute"`
	Error4xxRate      float64          `json:"error_4xx_rate"`
	Error5xxRate      float64          `json:"error_5xx_rate"`
	AvgLatencyMS      float64          `json:"avg_latency_ms"`
	P95LatencyMS      float64          `json:"p95_latency_ms"`
	P99LatencyMS      float64          `json:"p99_latency_ms"`
	TopEndpoints      []EndpointMetric `json:"top_endpoints"`
	SlowEndpoints     []EndpointMetric `json:"slow_endpoints"`
	RecentErrors      []APIErrorLog    `json:"recent_errors"`
}

type LongQueryItem struct {
	PID             int     `json:"pid"`
	DurationSeconds float64 `json:"duration_seconds"`
	QuerySanitized  string  `json:"query_sanitized"`
	State           string  `json:"state"`
}

type PostgresHealth struct {
	Reachable           bool            `json:"reachable"`
	ConnectionCount     int             `json:"connection_count"`
	ActiveConnections   int             `json:"active_connections"`
	IdleConnections     int             `json:"idle_connections"`
	DatabaseSizeBytes   int64           `json:"database_size_bytes"`
	DatabaseSizeFormatted string        `json:"database_size_formatted"`
	StorageUsagePercent float64         `json:"storage_usage_percent"`
	MigrationVersion    string          `json:"migration_version"`
	LastBackupStatus    string          `json:"last_backup_status"`
	LongRunningQueries  []LongQueryItem `json:"long_running_queries"`
}

type RedisHealth struct {
	Reachable           bool    `json:"reachable"`
	LatencyMS           int     `json:"latency_ms"`
	MemoryUsedBytes     int64   `json:"memory_used_bytes"`
	MemoryUsedFormatted string  `json:"memory_used_formatted"`
	KeyCount            int64   `json:"key_count"`
	ConnectedClients    int     `json:"connected_clients"`
	EvictionCount       int64   `json:"eviction_count"`
	CacheHitRate        float64 `json:"cache_hit_rate"`
}

type QueueStatItem struct {
	QueueName       string `json:"queue_name"`
	PendingCount    int64  `json:"pending_count"`
	ProcessingCount int64  `json:"processing_count"`
	FailedCount     int64  `json:"failed_count"`
}

type WorkerMetrics struct {
	QueuedJobs     int64           `json:"queued_jobs"`
	ActiveJobs     int64           `json:"active_jobs"`
	CompletedJobs  int64           `json:"completed_jobs"`
	FailedJobs     int64           `json:"failed_jobs"`
	RetryingJobs   int64           `json:"retrying_jobs"`
	DeadJobs       int64           `json:"dead_jobs"`
	QueueStats     []QueueStatItem `json:"queue_stats"`
}

type WorkerJobItem struct {
	JobID       string     `json:"job_id"`
	JobType     string     `json:"job_type"`
	Queue       string     `json:"queue"`
	CreatedAt   time.Time  `json:"created_at"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	FinishedAt  *time.Time `json:"finished_at,omitempty"`
	RetryCount  int        `json:"retry_count"`
	Status      string     `json:"status"` // QUEUED, RUNNING, COMPLETED, FAILED, DEAD
	LastError   string     `json:"last_error,omitempty"`
}

type VisualSearchHealth struct {
	ServiceName          string     `json:"service_name"`
	Status               string     `json:"status"` // HEALTHY, DEGRADED, DOWN, NOT_DEPLOYED
	LatencyMS            int        `json:"latency_ms"`
	ErrorCount           int64      `json:"error_count"`
	LastSuccessfulRequest *time.Time `json:"last_successful_request,omitempty"`
	Reachable            bool       `json:"reachable"`
}

type BackupSummary struct {
	LastSuccessfulBackup *time.Time `json:"last_successful_backup,omitempty"`
	BackupStartTime      *time.Time `json:"backup_start_time,omitempty"`
	BackupEndTime        *time.Time `json:"backup_end_time,omitempty"`
	BackupSizeBytes      int64      `json:"backup_size_bytes"`
	BackupSizeFormatted  string     `json:"backup_size_formatted"`
	NextScheduledBackup  *time.Time `json:"next_scheduled_backup,omitempty"`
	LastFailure          *time.Time `json:"last_failure,omitempty"`
	RetentionPolicy      string     `json:"retention_policy"`
	BackupStatus         string     `json:"backup_status"` // OK, OVERDUE, FAILED, NOT_CONFIGURED
}

type MigrationItem struct {
	Version   string    `json:"version"`
	Name      string    `json:"name"`
	AppliedAt time.Time `json:"applied_at"`
	Status    string    `json:"status"`
}

type MigrationSummary struct {
	CurrentVersion   string          `json:"current_version"`
	AppliedCount     int             `json:"applied_count"`
	PendingCount     int             `json:"pending_count"`
	FailedCount      int             `json:"failed_count"`
	LastAppliedAt    *time.Time      `json:"last_applied_at,omitempty"`
	AppliedMigrations []MigrationItem `json:"applied_migrations"`
}

type SanitizedEmailLog struct {
	RecipientMasked string    `json:"recipient_masked"`
	EmailType       string    `json:"email_type"`
	Timestamp       time.Time `json:"timestamp"`
	Status          string    `json:"status"`
	FailureCategory string    `json:"failure_category,omitempty"`
}

type EmailHealth struct {
	SMTPReachable             bool                `json:"smtp_reachable"`
	ActivationEmailSuccessRate float64             `json:"activation_email_success_rate"`
	EmployeeInviteSuccessRate float64             `json:"employee_invite_success_rate"`
	QueuedEmails              int                 `json:"queued_emails"`
	LastSuccessfulEmail       *time.Time          `json:"last_successful_email,omitempty"`
	RecentFailuresCount       int                 `json:"recent_failures_count"`
	RecentLogs                []SanitizedEmailLog `json:"recent_logs"`
}

type AdminSessionItem struct {
	SessionID  uuid.UUID `json:"session_id"`
	AdminID    uuid.UUID `json:"admin_id"`
	AdminEmail string    `json:"admin_email"`
	AdminRole  string    `json:"admin_role"`
	DeviceInfo string    `json:"device_info"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
	LastSeen   time.Time `json:"last_seen"`
	ExpiresAt  time.Time `json:"expires_at"`
	Revoked    bool      `json:"revoked"`
}

type SecurityEventItem struct {
	ID        uuid.UUID              `json:"id"`
	EventType string                 `json:"event_type"`
	Severity  string                 `json:"severity"` // INFO, WARNING, HIGH, CRITICAL
	ActorID   *uuid.UUID             `json:"actor_id,omitempty"`
	TargetID  *uuid.UUID             `json:"target_id,omitempty"`
	IPAddress string                 `json:"ip_address,omitempty"`
	UserAgent string                 `json:"user_agent,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Status    string                 `json:"status"` // NEW, ACKNOWLEDGED, RESOLVED, IGNORED
	CreatedAt time.Time              `json:"created_at"`
}

type AppVersionItem struct {
	ID                  uuid.UUID `json:"id"`
	Platform            string    `json:"platform"` // WEB, ANDROID, API
	CurrentVersion      string    `json:"current_version"`
	MinSupportedVersion string    `json:"min_supported_version"`
	RecommendedVersion  string    `json:"recommended_version"`
	UpdatedBy           *uuid.UUID `json:"updated_by,omitempty"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type TechnicalOverviewKPIs struct {
	APIStatus           string `json:"api_status"`
	DBStatus            string `json:"db_status"`
	RedisStatus         string `json:"redis_status"`
	WorkerStatus        string `json:"worker_status"`
	FailedJobsCount     int64  `json:"failed_jobs_count"`
	CriticalErrorsCount int    `json:"critical_errors_count"`
	BackupStatus        string `json:"backup_status"`
	MigrationStatus     string `json:"migration_status"`
	SecurityAlertsCount int    `json:"security_alerts_count"`
	ActiveSessionsCount int    `json:"active_sessions_count"`
	WebVersion          string `json:"web_version"`
	AndroidVersion      string `json:"android_version"`
}

type RetryJobRequest struct {
	Reason string `json:"reason"`
}

type RevokeSessionRequest struct {
	Reason string `json:"reason"`
}

type UpdateAppVersionRequest struct {
	CurrentVersion      string `json:"current_version"`
	MinSupportedVersion string `json:"min_supported_version"`
	RecommendedVersion  string `json:"recommended_version"`
	Reason              string `json:"reason"`
}

type AcknowledgeSecurityEventRequest struct {
	Status string `json:"status"` // ACKNOWLEDGED, RESOLVED, IGNORED
	Reason string `json:"reason"`
}
