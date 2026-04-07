-- Migration: Add platform tenant for Super Admin support
-- The platform tenant is a system-level tenant that holds super admin users.
-- Users with role 'super_admin' belong to this tenant and have cross-tenant access.

INSERT INTO tenants (id, name, slug, plan, status, metadata, created_at, updated_at)
VALUES ('platform', 'Platform Admin', 'platform', 'enterprise', 'active', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_settings (id, tenant_id, created_at, updated_at)
SELECT gen_random_uuid()::text, 'platform', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM tenant_settings WHERE tenant_id = 'platform');
