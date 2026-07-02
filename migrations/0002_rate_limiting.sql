-- Add rate limiting table to prevent abuse
CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_time ON rate_limit_entries(ip_hash, timestamp);