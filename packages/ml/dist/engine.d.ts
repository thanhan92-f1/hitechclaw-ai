/**
 * MLEngine — Main entrypoint that orchestrates datasets, training,
 * AutoML pipelines, and the model registry.
 */
import type { Dataset, DatasetProfile, AutoMLConfig, AutoMLPipeline, TrainedModel, FeaturePipeline } from './types.js';
import { algorithms } from './algorithms.js';
import { ModelRegistry } from './model-registry.js';
import { AutoMLEngine } from './automl.js';
export declare class MLEngine {
    readonly datasets: Map<string, Dataset>;
    readonly modelRegistry: ModelRegistry;
    readonly automl: AutoMLEngine;
    readonly featurePipelines: Map<string, FeaturePipeline>;
    constructor();
    /** Load dataset from CSV string */
    loadCSV(csv: string, options?: {
        delimiter?: string;
        name?: string;
    }): Dataset;
    /** Load dataset from JSON string */
    loadJSON(json: string, options?: {
        name?: string;
    }): Dataset;
    /** Get dataset by ID */
    getDataset(datasetId: string): Dataset | undefined;
    /** List all loaded datasets */
    listDatasets(): Array<{
        id: string;
        name: string;
        rows: number;
        columns: number;
    }>;
    /** Delete a dataset */
    deleteDataset(datasetId: string): boolean;
    /** Profile a dataset */
    profileDataset(datasetId: string): DatasetProfile | undefined;
    /** Create and save a feature pipeline */
    createFeaturePipeline(pipeline: FeaturePipeline): void;
    /** Apply a saved pipeline to a dataset */
    transformDataset(datasetId: string, pipelineId: string): Dataset | undefined;
    /** Train a single model with explicit algorithm and hyperparameters */
    trainModel(params: {
        datasetId: string;
        algorithmId: string;
        targetColumn: string;
        hyperparameters?: Record<string, unknown>;
        trainTestSplit?: number;
        name?: string;
    }): TrainedModel | undefined;
    /** Run an AutoML pipeline */
    runAutoML(datasetId: string, config: AutoMLConfig, options?: {
        name?: string;
    }): Promise<AutoMLPipeline | undefined>;
    /** List all available algorithms */
    listAlgorithms(): typeof algorithms;
    /** List algorithms for a specific task */
    listAlgorithmsForTask(taskType: string): typeof algorithms;
    /** Get engine status summary */
    getSummary(): {
        datasets: number;
        models: number;
        pipelines: number;
        algorithms: number;
    };
}
//# sourceMappingURL=engine.d.ts.map