// ============================================================
// Guardrails — Type definitions for AI safety pipeline
// ============================================================

/** Result of running a single guardrail check */
export interface GuardrailResult {
  /** Whether the content passed the check */
  pass: boolean;
  /** Reason if blocked (only when pass=false) */
  blockedReason?: string;
  /** Modified/sanitized content (if guardrail rewrites content) */
  sanitized?: string;
  /** Name of the guardrail that produced this result */
  guardrailName: string;
  /** Processing time in ms */
  durationMs: number;
  /** Confidence score 0-1 (for ML-based checks) */
  confidence?: number;
}

/** A single input guardrail — runs BEFORE the LLM call */
export interface InputGuardrail {
  readonly name: string;
  check(input: string, context: GuardrailContext): Promise<GuardrailResult>;
}

/** A single output guardrail — runs AFTER the LLM response */
export interface OutputGuardrail {
  readonly name: string;
  check(output: string, context: GuardrailContext): Promise<GuardrailResult>;
}

/** Context passed to guardrails for decision-making */
export interface GuardrailContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  agentId: string;
  /** Domain pack in use (healthcare, finance, etc.) */
  domainId?: string;
  /** System prompt (hashed — not raw) for reference */
  systemPromptHash?: string;
}

/** Overall pipeline result after all guardrails run */
export interface GuardrailPipelineResult {
  /** Whether all guardrails passed */
  passed: boolean;
  /** First blocking result (if any) */
  blockedBy?: GuardrailResult;
  /** All individual results */
  results: GuardrailResult[];
  /** Final content (may be sanitized) */
  finalContent: string;
  /** Total pipeline duration ms */
  totalDurationMs: number;
}
