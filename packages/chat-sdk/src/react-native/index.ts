// ============================================================
// @hitechclaw/chat-sdk/react-native — React Native Compatibility
// ============================================================
//
// React Native's fetch doesn't support ReadableStream natively.
// This module provides a polyfill-based client factory and
// re-exports all React hooks (they work identically).
//
// Usage:
//   import { HiTechClawProvider, useChat, createReactNativeConfig } from '@hitechclaw/chat-sdk/react-native';
//
//   const config = createReactNativeConfig({ baseUrl: 'https://api.hitechclaw.io', token: '...' });
//   <HiTechClawProvider config={config}><App /></HiTechClawProvider>
//

export { HiTechClawProvider, useHiTechClawClient, useChat, useSessions } from '../react/index.js';
export type { HiTechClawProviderProps, UseChatOptions, UseChatReturn, UseSessionsReturn } from '../react/index.js';

import type { HiTechClawConfig } from '../types.js';

/**
 * SSE line parser for environments without ReadableStream.
 * Works with React Native's XMLHttpRequest-based fetch polyfills.
 */
export function parseSSELines(raw: string): Array<{ event?: string; data: string }> {
    const results: Array<{ event?: string; data: string }> = [];
    let currentEvent: string | undefined;
    let currentData: string[] = [];

    for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
            currentData.push(line.slice(6));
        } else if (line.trim() === '' && currentData.length > 0) {
            results.push({ event: currentEvent, data: currentData.join('\n') });
            currentEvent = undefined;
            currentData = [];
        }
    }

    // Flush remaining
    if (currentData.length > 0) {
        results.push({ event: currentEvent, data: currentData.join('\n') });
    }

    return results;
}

/**
 * Create HiTechClaw config optimized for React Native.
 *
 * If your React Native environment has proper streaming fetch (Hermes + RN 0.73+),
 * no polyfill is needed. Otherwise, pass a custom fetch or use react-native-sse.
 *
 * @example
 * ```tsx
 * import { createReactNativeConfig } from '@hitechclaw/chat-sdk/react-native';
 *
 * const config = createReactNativeConfig({
 *   baseUrl: 'https://api.hitechclaw.io',
 *   token: 'your-jwt-token',
 * });
 * ```
 */
export function createReactNativeConfig(
    options: Omit<HiTechClawConfig, 'fetch'> & { fetch?: typeof globalThis.fetch },
): HiTechClawConfig {
    return {
        timeout: 120_000, // longer timeout for mobile
        ...options,
        headers: {
            Accept: 'text/event-stream',
            ...options.headers,
        },
    };
}

/**
 * Helper to create a non-streaming fallback config for React Native
 * environments that don't support SSE at all.
 *
 * Uses polling instead of streaming — chat() calls will use stream: false.
 */
export function createReactNativePollingConfig(
    options: Omit<HiTechClawConfig, 'fetch'>,
): HiTechClawConfig & { __polling: true } {
    return {
        timeout: 120_000,
        ...options,
        __polling: true,
    } as HiTechClawConfig & { __polling: true };
}
