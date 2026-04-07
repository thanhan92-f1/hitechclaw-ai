/**
 * Built-in algorithm catalog.
 * These are the algorithms the ML engine can "train" using
 * pure TypeScript implementations or delegating to external runtimes.
 */
import type { Algorithm } from './types.js';
export declare const algorithms: Algorithm[];
/**
 * Get all algorithms that support a given task type.
 */
export declare function getAlgorithmsForTask(taskType: string): Algorithm[];
/**
 * Get algorithm definition by ID.
 */
export declare function getAlgorithm(algorithmId: string): Algorithm | undefined;
//# sourceMappingURL=algorithms.d.ts.map