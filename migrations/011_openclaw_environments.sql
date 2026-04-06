CREATE TABLE IF NOT EXISTS openclaw_environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_url TEXT NOT NULL,
  gateway_url TEXT,
  management_api_key TEXT,
  gateway_token TEXT,
  auth_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_environments_active_sort
  ON openclaw_environments (is_active DESC, is_default DESC, sort_order ASC, name ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_openclaw_environments_default_true
  ON openclaw_environments (is_default)
  WHERE is_default = TRUE;

INSERT INTO openclaw_environments (
  id,
  name,
  slug,
  description,
  base_url,
  gateway_url,
  management_api_key,
  gateway_token,
  auth_token,
  is_active,
  is_default,
  sort_order,
  config
)
SELECT
  'default',
  'Default OpenClaw',
  'default',
  'Bootstrapped default environment. Update it from Settings → OpenClaw.',
  'http://localhost:9998',
  NULL,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  0,
  jsonb_build_object(
    'source', 'migration-bootstrap'
  )
WHERE NOT EXISTS (SELECT 1 FROM openclaw_environments);
