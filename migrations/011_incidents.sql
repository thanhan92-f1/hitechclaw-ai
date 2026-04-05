-- Migration 011: Incident management tables

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'P3',
  status TEXT NOT NULL DEFAULT 'created',
  assigned_to TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  source_type TEXT,
  source_id TEXT,
  sla_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_created
  ON incidents (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_status_severity
  ON incidents (status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_updates (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL DEFAULT 'comment',
  content TEXT,
  author TEXT NOT NULL DEFAULT 'admin',
  previous_value TEXT,
  new_value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_created
  ON incident_updates (incident_id, created_at ASC);