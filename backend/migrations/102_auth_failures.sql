-- Auth failures tracking for admin notifications
CREATE TABLE auth_failures (
  id BIGSERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'seller', 'courier', 'buyer'
  error_code VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for fast lookups
CREATE INDEX idx_auth_failures_created_at ON auth_failures(created_at DESC);
CREATE INDEX idx_auth_failures_role ON auth_failures(role);
CREATE INDEX idx_auth_failures_email ON auth_failures(user_email);

-- Retention policy comment
COMMENT ON TABLE auth_failures IS 'Stores login/signup failures for admin monitoring. Data automatically purged after 30 days via cron job.';
