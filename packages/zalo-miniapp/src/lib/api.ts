import { HiTechClawClient } from '@hitechclaw/chat-sdk';
import { getStoredToken } from './zalo-auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const hitechclaw = new HiTechClawClient({
  baseUrl: API_BASE_URL,
  token: getStoredToken() || undefined,
});

/** Update client token after login */
export function setApiToken(token: string): void {
  hitechclaw.setToken(token);
}

/** Get the API base URL */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export { hitechclaw as default };
