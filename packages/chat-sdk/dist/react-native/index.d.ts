export { HiTechClawProvider, useHiTechClawClient, useChat, useSessions } from '../react/index.js';
export type { HiTechClawProviderProps, UseChatOptions, UseChatReturn, UseSessionsReturn } from '../react/index.js';
import type { HiTechClawConfig } from '../types.js';
/**
 * SSE line parser for environments without ReadableStream.
 * Works with React Native's XMLHttpRequest-based fetch polyfills.
 */
export declare function parseSSELines(raw: string): Array<{
    event?: string;
    data: string;
}>;
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
export declare function createReactNativeConfig(options: Omit<HiTechClawConfig, 'fetch'> & {
    fetch?: typeof globalThis.fetch;
}): HiTechClawConfig;
/**
 * Helper to create a non-streaming fallback config for React Native
 * environments that don't support SSE at all.
 *
 * Uses polling instead of streaming — chat() calls will use stream: false.
 */
export declare function createReactNativePollingConfig(options: Omit<HiTechClawConfig, 'fetch'>): HiTechClawConfig & {
    __polling: true;
};
//# sourceMappingURL=index.d.ts.map