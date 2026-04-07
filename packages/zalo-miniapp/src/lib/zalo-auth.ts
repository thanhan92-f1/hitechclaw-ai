import { getAccessToken, getUserInfo } from 'zmp-sdk';
import type { ZaloUserInfo } from 'zmp-sdk';

const TOKEN_KEY = 'hitechclaw_token';
const USER_KEY = 'hitechclaw_user';

export interface HiTechClawUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  avatarUrl?: string | null;
}

interface AuthResponse {
  token: string;
  expiresIn: number;
  user: HiTechClawUser;
}

/** Get Zalo access token from ZMP SDK — falls back to dev mode */
async function getZaloToken(): Promise<string> {
  try {
    return await getAccessToken();
  } catch {
    // In dev/simulator, getAccessToken may fail — use dev bypass
    return 'dev-simulator-token';
  }
}

/** Get Zalo user info from ZMP SDK */
export function getZaloUserInfo(): Promise<ZaloUserInfo> {
  return new Promise((resolve, reject) => {
    getUserInfo({
      success: (data) => resolve(data.userInfo),
      fail: (err) => reject(err),
    });
  });
}

/** Exchange Zalo token for HiTechClaw JWT — with dev fallback */
export async function loginWithZalo(apiBaseUrl: string, tenantSlug?: string): Promise<AuthResponse> {
  const zaloToken = await getZaloToken();

  // Try Zalo Mini App auth first
  const res = await fetch(`${apiBaseUrl}/auth/zalo-miniapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: zaloToken,
      tenantSlug: tenantSlug || import.meta.env.VITE_TENANT_SLUG || 'default',
    }),
  });

  if (res.ok) {
    const data = await res.json() as AuthResponse;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  }

  // Fallback: use standard login for dev/simulator
  const devEmail = import.meta.env.VITE_DEV_EMAIL || 'demo@hitechclaw.ai';
  const devPassword = import.meta.env.VITE_DEV_PASSWORD || 'demo1234';

  const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: devEmail, password: devPassword }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error || `Auth failed: ${loginRes.status}`);
  }

  const data = await loginRes.json() as AuthResponse;
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

/** Get stored HiTechClaw token */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Get stored user info */
export function getStoredUser(): HiTechClawUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HiTechClawUser;
  } catch {
    return null;
  }
}

/** Clear stored auth data */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Check if running inside Zalo Mini App environment */
export function isZaloEnvironment(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.ZaloPay;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    ZaloPay?: unknown;
  }
}
