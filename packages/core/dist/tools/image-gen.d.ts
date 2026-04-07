import type { ToolDefinition } from '@hitechclaw/shared';
import type { ToolHandler } from './tool-registry.js';
/**
 * Image Generation Tool — Generate images using DALL-E 3 or Stability AI.
 * Uses OpenAI's image generation API with fallback support.
 */
export declare const imageGenDefinition: ToolDefinition;
export declare function createImageGenHandler(apiKey?: string): ToolHandler;
//# sourceMappingURL=image-gen.d.ts.map