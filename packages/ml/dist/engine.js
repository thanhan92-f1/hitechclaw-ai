import { parseCSV, parseJSON, profileDataset, splitDataset, applyFeaturePipeline } from './dataset.js';
import { algorithms, getAlgorithmsForTask, getAlgorithm } from './algorithms.js';
import { trainModel } from './trainers.js';
import { ModelRegistry } from './model-registry.js';
import { AutoMLEngine } from './automl.js';
export class MLEngine {
    datasets = new Map();
    modelRegistry;
    automl;
    featurePipelines = new Map();
    constructor() {
        this.modelRegistry = new ModelRegistry();
        this.automl = new AutoMLEngine(this.modelRegistry);
    }
    // ─── Dataset Management ─────────────────────────────────
    /** Load dataset from CSV string */
    loadCSV(csv, options) {
        const dataset = parseCSV(csv, options);
        dataset.profile = profileDataset(dataset);
        this.datasets.set(dataset.id, dataset);
        return dataset;
    }
    /** Load dataset from JSON string */
    loadJSON(json, options) {
        const dataset = parseJSON(json, options);
        dataset.profile = profileDataset(dataset);
        this.datasets.set(dataset.id, dataset);
        return dataset;
    }
    /** Get dataset by ID */
    getDataset(datasetId) {
        return this.datasets.get(datasetId);
    }
    /** List all loaded datasets */
    listDatasets() {
        return [...this.datasets.values()].map((d) => ({
            id: d.id,
            name: d.name,
            rows: d.rows.length,
            columns: d.columns.length,
        }));
    }
    /** Delete a dataset */
    deleteDataset(datasetId) {
        return this.datasets.delete(datasetId);
    }
    /** Profile a dataset */
    profileDataset(datasetId) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            return undefined;
        if (!dataset.profile)
            dataset.profile = profileDataset(dataset);
        return dataset.profile;
    }
    // ─── Feature Engineering ────────────────────────────────
    /** Create and save a feature pipeline */
    createFeaturePipeline(pipeline) {
        this.featurePipelines.set(pipeline.id, pipeline);
    }
    /** Apply a saved pipeline to a dataset */
    transformDataset(datasetId, pipelineId) {
        const dataset = this.datasets.get(datasetId);
        const pipeline = this.featurePipelines.get(pipelineId);
        if (!dataset || !pipeline)
            return undefined;
        const { transformedRows, newColumns } = applyFeaturePipeline(dataset, pipeline);
        const transformed = {
            id: crypto.randomUUID(),
            name: `${dataset.name} (transformed)`,
            source: dataset.source,
            columns: newColumns,
            rows: transformedRows,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [...(dataset.tags ?? []), 'transformed'],
        };
        transformed.profile = profileDataset(transformed);
        this.datasets.set(transformed.id, transformed);
        return transformed;
    }
    // ─── Training ───────────────────────────────────────────
    /** Train a single model with explicit algorithm and hyperparameters */
    trainModel(params) {
        const dataset = this.datasets.get(params.datasetId);
        if (!dataset)
            return undefined;
        const algorithm = getAlgorithm(params.algorithmId);
        if (!algorithm)
            return undefined;
        const targetIdx = dataset.columns.indexOf(params.targetColumn);
        if (targetIdx === -1)
            return undefined;
        const featureNames = dataset.columns.filter((_, i) => i !== targetIdx);
        const featureIndices = dataset.columns.map((_, i) => i).filter((i) => i !== targetIdx);
        const allX = dataset.rows.map((row) => featureIndices.map((i) => {
            const v = row[i];
            return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0;
        }));
        const allY = dataset.rows.map((row) => row[targetIdx]);
        // Split
        const splitRatio = params.trainTestSplit ?? 0.8;
        const split = splitDataset({ ...dataset, rows: allX.map((x, i) => [...x, allY[i]]) }, [splitRatio, 1 - splitRatio]);
        const nF = featureNames.length;
        const xTrain = split.train.rows.map((r) => r.slice(0, nF));
        const yTrain = split.train.rows.map((r) => r[nF]);
        const xTest = split.test.rows.map((r) => r.slice(0, nF));
        const yTest = split.test.rows.map((r) => r[nF]);
        const startTime = Date.now();
        const result = trainModel(params.algorithmId, xTrain, yTrain, xTest, yTest, params.hyperparameters ?? {}, featureNames);
        const model = {
            id: crypto.randomUUID(),
            name: params.name ?? `${algorithm.name}-${Date.now()}`,
            taskType: algorithm.supportedTasks[0],
            algorithmId: algorithm.id,
            algorithmName: algorithm.name,
            hyperparameters: params.hyperparameters ?? {},
            metrics: result.metrics,
            datasetId: params.datasetId,
            status: 'trained',
            featureImportance: result.featureImportance,
            trainingDurationMs: Date.now() - startTime,
            trainedAt: new Date(),
            version: '1.0.0',
        };
        this.modelRegistry.register(model);
        return model;
    }
    // ─── AutoML ─────────────────────────────────────────────
    /** Run an AutoML pipeline */
    async runAutoML(datasetId, config, options) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            return undefined;
        return this.automl.runPipeline(dataset, config, options);
    }
    // ─── Algorithms ─────────────────────────────────────────
    /** List all available algorithms */
    listAlgorithms() {
        return algorithms;
    }
    /** List algorithms for a specific task */
    listAlgorithmsForTask(taskType) {
        return getAlgorithmsForTask(taskType);
    }
    // ─── Summary ────────────────────────────────────────────
    /** Get engine status summary */
    getSummary() {
        return {
            datasets: this.datasets.size,
            models: this.modelRegistry.count,
            pipelines: this.automl.listPipelines().length,
            algorithms: algorithms.length,
        };
    }
}
//# sourceMappingURL=engine.js.map