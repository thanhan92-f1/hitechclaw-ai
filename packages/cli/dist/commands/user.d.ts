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
export declare function userCreate(options: {
    name: string;
    email: string;
    password: string;
    role?: string;
}): Promise<void>;
export declare function userRegister(options: {
    name: string;
    email: string;
    password: string;
    tenantName: string;
    tenantSlug: string;
}): Promise<void>;
//# sourceMappingURL=user.d.ts.map