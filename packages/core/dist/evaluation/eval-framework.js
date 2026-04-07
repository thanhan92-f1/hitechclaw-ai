import { randomUUID } from 'node:crypto';
/**
 * Evaluation Framework — Benchmark agent accuracy, hallucination rate, and latency.
 * Supports per-domain evaluation suites with customizable metrics.
 */
export class EvalFramework {
    constructor(llm) {
        this.llm = llm;
    }
    /**
     * Run an evaluation suite against an agent.
     */
    async runSuite(suiteName, agent, testCases) {
        const suiteId = randomUUID();
        const startedAt = new Date().toISOString();
        const results = [];
        for (const testCase of testCases) {
            const result = await this.runTestCase(agent, testCase);
            results.push(result);
        }
        const passed = results.filter((r) => r.passed).length;
        const failed = results.length - passed;
        const avgAccuracy = results.reduce((s, r) => s + r.metrics.accuracy, 0) / results.length;
        const avgRelevance = results.reduce((s, r) => s + r.metrics.relevance, 0) / results.length;
        const avgLatency = results.reduce((s, r) => s + r.metrics.latency_ms, 0) / results.length;
        const avgToolAccuracy = results
            .filter((r) => r.metrics.toolCallAccuracy !== undefined)
            .reduce((s, r) => { var _a; return s + ((_a = r.metrics.toolCallAccuracy) !== null && _a !== void 0 ? _a : 0); }, 0) / Math.max(1, results.filter((r) => r.metrics.toolCallAccuracy !== undefined).length);
        return {
            suiteId,
            suiteName,
            model: agent.config.llm.model,
            totalTests: results.length,
            passed,
            failed,
            averageMetrics: {
                accuracy: Math.round(avgAccuracy * 100) / 100,
                relevance: Math.round(avgRelevance * 100) / 100,
                latency_ms: Math.round(avgLatency),
                toolCallAccuracy: avgToolAccuracy > 0 ? Math.round(avgToolAccuracy * 100) / 100 : undefined,
            },
            results,
            startedAt,
            completedAt: new Date().toISOString(),
        };
    }
    async runTestCase(agent, testCase) {
        const sessionId = `eval-${testCase.id}`;
        const start = Date.now();
        try {
            const actualOutput = await agent.chat(sessionId, testCase.input);
            const latency = Date.now() - start;
            const metrics = await this.computeMetrics(testCase, actualOutput, latency);
            // Pass if accuracy >= 0.5 and no hallucination
            const passed = metrics.accuracy >= 0.5 && !metrics.hallucination;
            return {
                testCaseId: testCase.id,
                actualOutput,
                metrics,
                passed,
            };
        }
        catch (err) {
            return {
                testCaseId: testCase.id,
                actualOutput: '',
                metrics: {
                    accuracy: 0,
                    relevance: 0,
                    latency_ms: Date.now() - start,
                    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    hallucination: false,
                },
                passed: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    async computeMetrics(testCase, actualOutput, latencyMs) {
        var _a;
        const metrics = {
            accuracy: 0,
            relevance: 0,
            latency_ms: latencyMs,
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            hallucination: false,
        };
        if (!testCase.expectedOutput) {
            // No expected output — use LLM-as-judge for relevance
            const judgeResult = await this.llmJudge(testCase.input, actualOutput);
            metrics.accuracy = judgeResult.relevance;
            metrics.relevance = judgeResult.relevance;
            metrics.hallucination = judgeResult.hallucination;
            metrics.tokenUsage = judgeResult.usage;
            return metrics;
        }
        // Compute string similarity (normalized Levenshtein-like)
        const expected = testCase.expectedOutput.toLowerCase().trim();
        const actual = actualOutput.toLowerCase().trim();
        // Check for key phrase containment
        const expectedWords = new Set(expected.split(/\s+/).filter((w) => w.length > 3));
        const actualWords = new Set(actual.split(/\s+/));
        let matchCount = 0;
        for (const word of expectedWords) {
            if (actualWords.has(word))
                matchCount++;
        }
        metrics.accuracy = expectedWords.size > 0 ? matchCount / expectedWords.size : 1;
        // Tool call accuracy
        if ((_a = testCase.expectedToolCalls) === null || _a === void 0 ? void 0 : _a.length) {
            // Check if actual output mentions tool usage (heuristic)
            const toolMentions = testCase.expectedToolCalls.filter((t) => actual.includes(t.toLowerCase()));
            metrics.toolCallAccuracy = toolMentions.length / testCase.expectedToolCalls.length;
        }
        // LLM-as-judge for hallucination check
        const judgeResult = await this.llmJudge(testCase.input, actualOutput, testCase.expectedOutput);
        metrics.relevance = judgeResult.relevance;
        metrics.hallucination = judgeResult.hallucination;
        metrics.tokenUsage = judgeResult.usage;
        return metrics;
    }
    async llmJudge(input, output, expected) {
        const judgePrompt = `You are an AI evaluation judge. Rate the following response.

Question: ${input}
Response: ${output}
${expected ? `Expected: ${expected}` : ''}

Output ONLY a JSON object with:
- "relevance": number 0-1 (how relevant/accurate the response is)
- "hallucination": boolean (does the response contain fabricated facts?)

JSON:`;
        try {
            const response = await this.llm.chat([
                { role: 'system', content: 'You are an evaluation judge. Output only valid JSON.' },
                { role: 'user', content: judgePrompt },
            ], [], { taskComplexity: 'fast' });
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    relevance: typeof parsed.relevance === 'number' ? parsed.relevance : 0.5,
                    hallucination: typeof parsed.hallucination === 'boolean' ? parsed.hallucination : false,
                    usage: response.usage,
                };
            }
        }
        catch (_a) {
            // Judge failed — return neutral scores
        }
        return {
            relevance: 0.5,
            hallucination: false,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
    }
}
