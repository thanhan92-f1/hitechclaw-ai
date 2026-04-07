/**
 * Model Registry — Store, version, and manage trained models.
 */
import type { TrainedModel, ModelStatus } from './types.js';
export declare class ModelRegistry {
    private models;
    /** Register a trained model */
    register(model: TrainedModel): void;
    /** Get model by ID */
    get(modelId: string): TrainedModel | undefined;
    /** List all models, optionally filtered */
    list(filter?: {
        taskType?: string;
        status?: ModelStatus;
        datasetId?: string;
        algorithmId?: string;
    }): TrainedModel[];
    /** Update model status */
    updateStatus(modelId: string, status: ModelStatus): void;
    /** Delete a model */
    delete(modelId: string): boolean;
    /** Compare multiple models by their metrics */
    compare(modelIds: string[]): Array<{
        model: TrainedModel;
        rank: number;
    }>;
    /** Get model count */
    get count(): number;
    /** Export registry state as JSON-serializable object */
    export(): TrainedModel[];
    /** Import models from serialized state */
    import(models: TrainedModel[]): void;
}
//# sourceMappingURL=model-registry.d.ts.map