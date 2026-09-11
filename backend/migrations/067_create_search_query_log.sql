CREATE TABLE IF NOT EXISTS search_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL DEFAULT '',
  results_count INTEGER NOT NULL DEFAULT 0 CHECK (results_count >= 0),
  search_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_query_log_created_at ON search_query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_query_log_query ON search_query_log(LOWER(query));
