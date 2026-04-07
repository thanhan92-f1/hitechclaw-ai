/**
 * User CLI commands — create users via HiTechClaw API.
 *
 * Usage:
 *   hitechclaw user create --name "John" --email john@example.com --password secret123
 *   hitechclaw user create --name "John" --email john@example.com --password secret123 --role admin
 *
 * Required env vars:
 *   HITECHCLAW_URL    Base URL of the HiTechClaw server (default: http://localhost:5001)
 *   HITECHCLAW_TOKEN  JWT token of an admin/owner user
 */

export async function userCreate(options: {
  name: string;
  email: string;
  password: string;
  role?: string;
}) {
  const baseUrl = process.env['HITECHCLAW_URL'] ?? 'http://localhost:5001';
  const token = process.env['HITECHCLAW_TOKEN'];

  if (!token) {
    console.error('❌ HITECHCLAW_TOKEN env var is required.');
    console.error('   Get a token via: hitechclaw login --email <email> --password <password>');
    process.exit(1);
  }

  const { name, email, password, role = 'member' } = options;

  if (!name || !email || !password) {
    console.error('❌ --name, --email, and --password are required.');
    process.exit(1);
  }

  try {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const err = (data as { error?: string }).error ?? res.statusText;
      console.error(`❌ Failed to create user: ${err}`);
      process.exit(1);
    }

    const user = (data as { user: { id: string; name: string; email: string; role: string; tenantId: string } }).user;
    console.log('✅ User created successfully!');
    console.log(`   ID:       ${user.id}`);
    console.log(`   Name:     ${user.name}`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Role:     ${user.role}`);
    console.log(`   TenantID: ${user.tenantId}`);
  } catch (err) {
    console.error(`❌ Request failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function userRegister(options: {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const baseUrl = process.env['HITECHCLAW_URL'] ?? 'http://localhost:5001';
  const { name, email, password, tenantName, tenantSlug } = options;

  if (!name || !email || !password || !tenantName || !tenantSlug) {
    console.error('❌ --name, --email, --password, --tenant-name, and --tenant-slug are required.');
    process.exit(1);
  }

  try {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, tenantName, tenantSlug }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const err = (data as { error?: string }).error ?? res.statusText;
      console.error(`❌ Registration failed: ${err}`);
      process.exit(1);
    }

    const { token, user, tenant } = data as {
      token: string;
      user: { id: string; name: string; email: string; role: string };
      tenant: { id: string; name: string; slug: string };
    };

    console.log('✅ Tenant + owner registered successfully!');
    console.log(`   Tenant:   ${tenant.name} (${tenant.slug})`);
    console.log(`   User:     ${user.name} <${user.email}> [${user.role}]`);
    console.log(`   Token:    ${token}`);
    console.log('');
    console.log('   Save your token:');
    console.log(`   export HITECHCLAW_TOKEN="${token}"`);
  } catch (err) {
    console.error(`❌ Request failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
