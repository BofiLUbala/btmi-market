-- Real-time active user sessions tracking
CREATE TABLE active_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'seller', 'courier', 'buyer'
  ip_address VARCHAR(45),
  user_agent TEXT,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activity_type VARCHAR(100), -- 'login', 'view_product', 'place_order', etc.
  activity_count INT DEFAULT 0,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indices for fast lookups
CREATE INDEX idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_role ON active_sessions(role);
CREATE INDEX idx_active_sessions_login_at ON active_sessions(login_at DESC);
CREATE INDEX idx_active_sessions_last_activity ON active_sessions(last_activity_at DESC);

-- Retention policy comment
COMMENT ON TABLE active_sessions IS 'Tracks live user sessions. Auto-purged on logout or session timeout (30 min idle).';
