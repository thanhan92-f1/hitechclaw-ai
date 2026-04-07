/**
 * DomainPack — A collection of skills, system prompts, and knowledge
 * for a specific industry or use case.
 */

/** JSON Schema-style parameter definition for domain skill tools */
export interface DomainToolParameters {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    items?: { type: string };
  }>;
  required?: string[];
}

/** A tool within a domain skill */
export interface DomainTool {
  name: string;
  description: string;
  parameters: DomainToolParameters;
  execute: (params: Record<string, unknown>) => Promise<DomainToolResult>;
}

export interface DomainToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** A skill within a domain pack (simpler than full SkillManifest) */
export interface DomainSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tools: DomainTool[];
}

export interface DomainPack {
  /** Unique identifier, e.g. 'healthcare', 'developer', 'finance' */
  id: string;
  /** Display name, e.g. 'Healthcare & Medical' */
  name: string;
  description: string;
  icon: string;
  /** Skills included in this domain pack */
  skills: DomainSkill[];
  /** System prompt for the specialist agent */
  agentPersona: string;
  /** Recommended integration IDs to pair with this domain */
  recommendedIntegrations: string[];
  /** Optional knowledge pack IDs */
  knowledgePacks?: string[];
}

/**
 * Helper to define a domain pack with type safety.
 */
export function defineDomainPack(pack: DomainPack): DomainPack {
  return pack;
}
