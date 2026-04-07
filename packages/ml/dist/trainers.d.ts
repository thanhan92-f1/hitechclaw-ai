/**
 * Pure TypeScript ML trainers — lightweight implementations for
 * common algorithms. These run in-process without Python/native deps.
 *
 * For production workloads, the external bridge (Python subprocess)
 * should be used instead. These are sufficient for small-to-medium datasets.
 */
import type { Hyperparameters, ModelMetrics } from './types.js';
export type TrainerResult = {
    metrics: ModelMetrics;
    predict: (input: number[][]) => unknown[];
    featureImportance?: Array<{
        feature: string;
        importance: number;
    }>;
};
/**
 * Train a model given algorithm ID, data, and hyperparameters.
 */
export declare function trainModel(algorithmId: string, xTrain: number[][], yTrain: unknown[], xTest: number[][], yTest: unknown[], hyperparams: Hyperparameters, featureNames: string[]): TrainerResult;
//# sourceMappingURL=trainers.d.ts.map