/**
 * Model Registry — Store, version, and manage trained models.
 */
import type { TrainedModel, ModelStatus, PredictionResult } from './types.js';

export class ModelRegistry {
  private models = new Map<string, TrainedModel>();

  /** Register a trained model */
  register(model: TrainedModel): void {
    this.models.set(model.id, model);
  }

  /** Get model by ID */
  get(modelId: string): TrainedModel | undefined {
    return this.models.get(modelId);
  }

  /** List all models, optionally filtered */
  list(filter?: {
    taskType?: string;
    status?: ModelStatus;
    datasetId?: string;
    algorithmId?: string;
  }): TrainedModel[] {
    let models = [...this.models.values()];
    if (filter?.taskType) models = models.filter((m) => m.taskType === filter.taskType);
    if (filter?.status) models = models.filter((m) => m.status === filter.status);
    if (filter?.datasetId) models = models.filter((m) => m.datasetId === filter.datasetId);
    if (filter?.algorithmId) models = models.filter((m) => m.algorithmId === filter.algorithmId);
    return models.sort((a, b) => b.trainedAt.getTime() - a.trainedAt.getTime());
  }

  /** Update model status */
  updateStatus(modelId: string, status: ModelStatus): void {
    const model = this.models.get(modelId);
    if (model) model.status = status;
  }

  /** Delete a model */
  delete(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /** Compare multiple models by their metrics */
  compare(modelIds: string[]): Array<{ model: TrainedModel; rank: number }> {
    const models = modelIds
      .map((id) => this.models.get(id))
      .filter((m): m is TrainedModel => m !== undefined);

    if (models.length === 0) return [];

    // Sort by primary metric (lower is better for regression, higher for classification)
    const ranked = [...models].sort((a, b) => {
      const metricA = getPrimaryMetricValue(a);
      const metricB = getPrimaryMetricValue(b);
      // Higher is better for accuracy/r2/f1/silhouette
      return metricB - metricA;
    });

    return ranked.map((model, idx) => ({ model, rank: idx + 1 }));
  }

  /** Get model count */
  get count(): number {
    return this.models.size;
  }

  /** Export registry state as JSON-serializable object */
  export(): TrainedModel[] {
    return [...this.models.values()];
  }

  /** Import models from serialized state */
  import(models: TrainedModel[]): void {
    for (const m of models) {
      this.models.set(m.id, { ...m, trainedAt: new Date(m.trainedAt) });
    }
  }
}

function getPrimaryMetricValue(model: TrainedModel): number {
  const m = model.metrics as unknown as Record<string, unknown>;
  // Try common metric keys in order of preference
  if ('f1Score' in m && typeof m.f1Score === 'number') return m.f1Score;
  if ('accuracy' in m && typeof m.accuracy === 'number') return m.accuracy;
  if ('r2' in m && typeof m.r2 === 'number') return m.r2;
  if ('silhouetteScore' in m && typeof m.silhouetteScore === 'number') return m.silhouetteScore;
  if ('auc' in m && typeof m.auc === 'number') return m.auc;
  // For regression error metrics (lower is better), negate
  if ('rmse' in m && typeof m.rmse === 'number') return -m.rmse;
  if ('mse' in m && typeof m.mse === 'number') return -m.mse;
  return 0;
}
