CREATE TABLE IF NOT EXISTS openclaw_managed_auth_records (
  environment_id TEXT PRIMARY KEY REFERENCES openclaw_environments(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  password_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_managed_auth_records_updated_at
  ON openclaw_managed_auth_records(updated_at DESC);

CREATE TABLE IF NOT EXISTS openclaw_backup_history (
  id UUID PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES openclaw_environments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  verified BOOLEAN,
  status TEXT NOT NULL DEFAULT 'recorded',
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_backup_history_environment_updated_at
  ON openclaw_backup_history(environment_id, updated_at DESC);