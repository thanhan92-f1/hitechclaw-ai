/**
 * AutoML Engine — automated model selection, hyperparameter tuning,
 * and pipeline orchestration.
 */
import type {
  AutoMLConfig,
  AutoMLPipeline,
  AutoMLTrial,
  Dataset,
  TrainedModel,
  Hyperparameters,
  HyperparameterDef,
  TaskType,
  ModelMetrics,
} from './types.js';
import { getAlgorithmsForTask, getAlgorithm } from './algorithms.js';
import { profileDataset, splitDataset, applyFeaturePipeline } from './dataset.js';
import { trainModel, type TrainerResult } from './trainers.js';
import { ModelRegistry } from './model-registry.js';

export class AutoMLEngine {
  private pipelines = new Map<string, AutoMLPipeline>();
  private modelRegistry: ModelRegistry;

  constructor(modelRegistry: ModelRegistry) {
    this.modelRegistry = modelRegistry;
  }

  /** Create and run an AutoML pipeline */
  async runPipeline(
    dataset: Dataset,
    config: AutoMLConfig,
    options?: { name?: string },
  ): Promise<AutoMLPipeline> {
    const pipeline: AutoMLPipeline = {
      id: crypto.randomUUID(),
      name: options?.name ?? `AutoML-${config.taskType}-${Date.now()}`,
      datasetId: dataset.id,
      config,
      status: 'running',
      trials: [],
      progress: 0,
      logs: [],
      startedAt: new Date(),
    };

    this.pipelines.set(pipeline.id, pipeline);
    pipeline.logs.push(`Pipeline started: ${pipeline.name}`);
    pipeline.logs.push(`Task type: ${config.taskType}, Optimize: ${config.optimizeMetric}`);

    try {
      // 1. Profile dataset
      if (!dataset.profile) {
        dataset.profile = profileDataset(dataset);
      }
      pipeline.logs.push(`Dataset: ${dataset.profile.rowCount} rows, ${dataset.profile.columnCount} columns`);

      // 2. Prepare features
      const targetIdx = dataset.columns.indexOf(config.targetColumn);
      if (targetIdx === -1) {
        throw new Error(`Target column "${config.targetColumn}" not found in dataset`);
      }

      const { xData, yData, featureNames } = prepareData(dataset, targetIdx);
      pipeline.logs.push(`Features: ${featureNames.length}, Target: ${config.targetColumn}`);

      // 3. Split data
      const split = splitDataset(
        { ...dataset, rows: xData.map((x, i) => [...x, yData[i]]) },
        [config.trainTestSplit, 1 - config.trainTestSplit],
      );

      const nFeatures = featureNames.length;
      const xTrain = split.train.rows.map((r) => r.slice(0, nFeatures) as number[]);
      const yTrain = split.train.rows.map((r) => r[nFeatures]);
      const xTest = split.test.rows.map((r) => r.slice(0, nFeatures) as number[]);
      const yTest = split.test.rows.map((r) => r[nFeatures]);

      pipeline.logs.push(`Train: ${xTrain.length} rows, Test: ${xTest.length} rows`);

      // 4. Get candidate algorithms
      const candidateAlgorithms = config.algorithms?.length
        ? config.algorithms.map((id) => getAlgorithm(id)).filter((a) => a !== undefined)
        : getAlgorithmsForTask(config.taskType);

      pipeline.logs.push(`Candidate algorithms: ${candidateAlgorithms.map((a) => a.name).join(', ')}`);

      // 5. Run trials
      const startTime = Date.now();
      let trialNumber = 0;

      for (const algorithm of candidateAlgorithms) {
        if (trialNumber >= config.maxTrials) break;
        if ((Date.now() - startTime) / 1000 > config.maxTimeSec) {
          pipeline.logs.push('Time limit reached');
          break;
        }

        // Generate hyperparameter combinations
        const hpCombinations = generateHyperparameters(
          algorithm.hyperparameters,
          config.strategy,
          Math.min(config.maxTrials - trialNumber, 3), // Max 3 combos per algorithm
        );

        for (const hpCombo of hpCombinations) {
          if (trialNumber >= config.maxTrials) break;
          if ((Date.now() - startTime) / 1000 > config.maxTimeSec) break;

          trialNumber++;
          pipeline.progress = Math.round((trialNumber / config.maxTrials) * 100);

          const trialStart = Date.now();
          try {
            const result = trainModel(
              algorithm.id, xTrain, yTrain, xTest, yTest, hpCombo, featureNames,
            );

            const trial: AutoMLTrial = {
              trialNumber,
              algorithmId: algorithm.id,
              hyperparameters: hpCombo,
              metrics: result.metrics,
              durationMs: Date.now() - trialStart,
              status: 'completed',
            };

            pipeline.trials.push(trial);
            pipeline.logs.push(
              `Trial ${trialNumber}: ${algorithm.name} — ${formatMetric(config.optimizeMetric, result.metrics)}`,
            );

            // Track best
            if (
              pipeline.bestTrialIndex === undefined ||
              isBetter(result.metrics, pipeline.trials[pipeline.bestTrialIndex].metrics, config.optimizeMetric)
            ) {
              pipeline.bestTrialIndex = pipeline.trials.length - 1;
            }
          } catch (err) {
            const trial: AutoMLTrial = {
              trialNumber,
              algorithmId: algorithm.id,
              hyperparameters: hpCombo,
              metrics: { accuracy: 0, precision: 0, recall: 0, f1Score: 0 },
              durationMs: Date.now() - trialStart,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            };
            pipeline.trials.push(trial);
            pipeline.logs.push(`Trial ${trialNumber}: ${algorithm.name} — FAILED: ${trial.error}`);
          }
        }
      }

      // 6. Register best model
      if (pipeline.bestTrialIndex !== undefined) {
        const bestTrial = pipeline.trials[pipeline.bestTrialIndex];
        const bestAlgorithm = getAlgorithm(bestTrial.algorithmId);

        const model: TrainedModel = {
          id: crypto.randomUUID(),
          name: `${pipeline.name}-best-${bestAlgorithm?.name ?? bestTrial.algorithmId}`,
          taskType: config.taskType,
          algorithmId: bestTrial.algorithmId,
          algorithmName: bestAlgorithm?.name ?? bestTrial.algorithmId,
          hyperparameters: bestTrial.hyperparameters,
          metrics: bestTrial.metrics,
          datasetId: dataset.id,
          status: 'trained',
          trainingDurationMs: bestTrial.durationMs,
          trainedAt: new Date(),
          version: '1.0.0',
          tags: ['automl', config.taskType],
        };

        this.modelRegistry.register(model);
        pipeline.bestModelId = model.id;
        pipeline.logs.push(
          `Best model: ${model.name} (${formatMetric(config.optimizeMetric, bestTrial.metrics)})`,
        );
      }

      pipeline.status = 'completed';
      pipeline.completedAt = new Date();
      pipeline.progress = 100;
      pipeline.logs.push(`Pipeline completed with ${pipeline.trials.length} trials`);
    } catch (err) {
      pipeline.status = 'failed';
      pipeline.logs.push(`Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return pipeline;
  }

  /** Get pipeline by ID */
  getPipeline(pipelineId: string): AutoMLPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  /** List all pipelines */
  listPipelines(): AutoMLPipeline[] {
    return [...this.pipelines.values()].sort(
      (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
    );
  }

  /** Cancel a running pipeline */
  cancelPipeline(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (pipeline && pipeline.status === 'running') {
      pipeline.status = 'cancelled';
      pipeline.logs.push('Pipeline cancelled by user');
      return true;
    }
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────

function prepareData(
  dataset: Dataset,
  targetIdx: number,
): { xData: number[][]; yData: unknown[]; featureNames: string[] } {
  const featureNames = dataset.columns.filter((_, i) => i !== targetIdx);
  const featureIndices = dataset.columns.map((_, i) => i).filter((i) => i !== targetIdx);

  const xData: number[][] = [];
  const yData: unknown[] = [];

  for (const row of dataset.rows) {
    const features = featureIndices.map((i) => {
      const val = row[i];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 1 : 0;
      return 0; // Non-numeric features get 0 (should be encoded first)
    });
    xData.push(features);
    yData.push(row[targetIdx]);
  }

  return { xData, yData, featureNames };
}

function generateHyperparameters(
  defs: HyperparameterDef[],
  strategy: string,
  count: number,
): Hyperparameters[] {
  const results: Hyperparameters[] = [];

  // Always include defaults first
  const defaults: Hyperparameters = {};
  for (const def of defs) defaults[def.name] = def.default;
  results.push(defaults);

  // Random search for additional combos
  for (let i = 1; i < count; i++) {
    const hp: Hyperparameters = {};
    for (const def of defs) {
      if (def.type === 'int') {
        const min = def.min ?? 1;
        const max = def.max ?? 100;
        hp[def.name] = Math.floor(Math.random() * (max - min + 1)) + min;
      } else if (def.type === 'float') {
        const min = def.min ?? 0;
        const max = def.max ?? 1;
        hp[def.name] = Math.random() * (max - min) + min;
      } else if (def.type === 'categorical' && def.choices) {
        hp[def.name] = def.choices[Math.floor(Math.random() * def.choices.length)];
      } else if (def.type === 'boolean') {
        hp[def.name] = Math.random() > 0.5;
      } else {
        hp[def.name] = def.default;
      }
    }
    results.push(hp);
  }

  return results;
}

function formatMetric(metricName: string, metrics: ModelMetrics): string {
  const m = metrics as unknown as Record<string, unknown>;
  const value = m[metricName];
  if (typeof value === 'number') return `${metricName}=${value.toFixed(4)}`;
  // Try common metric names
  for (const key of ['accuracy', 'f1Score', 'r2', 'rmse', 'silhouetteScore']) {
    if (key in m && typeof m[key] === 'number') {
      return `${key}=${(m[key] as number).toFixed(4)}`;
    }
  }
  return 'metrics computed';
}

function isBetter(a: ModelMetrics, b: ModelMetrics, metric: string): boolean {
  const aVal = (a as unknown as Record<string, unknown>)[metric];
  const bVal = (b as unknown as Record<string, unknown>)[metric];
  if (typeof aVal !== 'number' || typeof bVal !== 'number') return false;
  // For error metrics (lower is better)
  if (['mse', 'rmse', 'mae', 'mape'].includes(metric)) return aVal < bVal;
  // For score metrics (higher is better)
  return aVal > bVal;
}
