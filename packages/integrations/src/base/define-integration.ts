import type { IntegrationDefinition } from './types.js';

/**
 * Helper to define an integration with type safety.
 * Similar to defineSkill() pattern from @hitechclaw/core.
 */
export function defineIntegration(definition: IntegrationDefinition): IntegrationDefinition {
  return definition;
}
