CREATE TABLE IF NOT EXISTS short_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  title VARCHAR(160),
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls (created_at DESC);
