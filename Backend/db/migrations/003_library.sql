CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(7) NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  UNIQUE (user_id, color)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags (user_id, LOWER(name));
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_user_name ON folders (user_id, LOWER(name));
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS kind VARCHAR(3) NOT NULL DEFAULT 'url' CHECK (kind IN ('url', 'qr'));
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS qr_options JSONB;
CREATE TABLE IF NOT EXISTS short_url_tags (
  short_url_id UUID NOT NULL REFERENCES short_urls(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (short_url_id, tag_id)
);
CREATE TABLE IF NOT EXISTS click_logs (
  id BIGSERIAL PRIMARY KEY,
  short_url_id UUID NOT NULL REFERENCES short_urls(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_click_logs_link_time ON click_logs (short_url_id, accessed_at);
