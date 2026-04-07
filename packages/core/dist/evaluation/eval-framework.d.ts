import type { EvalSuiteResult, EvalTestCase } from '@hitechclaw/shared';
import type { Agent } from '../agent/agent.js';
import type { LLMRouter } from '../llm/llm-router.js';
/**
 * Evaluation Framework — Benchmark agent accuracy, hallucination rate, and latency.
 * Supports per-domain evaluation suites with customizable metrics.
 */
export declare class EvalFramework {
    private llm;
    constructor(llm: LLMRouter);
    /**
     * Run an evaluation suite against an agent.
     */
    runSuite(suiteName: string, agent: Agent, testCases: EvalTestCase[]): Promise<EvalSuiteResult>;
    private runTestCase;
    private computeMetrics;
    private llmJudge;
}
//# sourceMappingURL=eval-framework.d.ts.map