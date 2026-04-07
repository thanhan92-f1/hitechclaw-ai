/**
 * AutoML Engine — automated model selection, hyperparameter tuning,
 * and pipeline orchestration.
 */
import type { AutoMLConfig, AutoMLPipeline, Dataset } from './types.js';
import { ModelRegistry } from './model-registry.js';
export declare class AutoMLEngine {
    private pipelines;
    private modelRegistry;
    constructor(modelRegistry: ModelRegistry);
    /** Create and run an AutoML pipeline */
    runPipeline(dataset: Dataset, config: AutoMLConfig, options?: {
        name?: string;
    }): Promise<AutoMLPipeline>;
    /** Get pipeline by ID */
    getPipeline(pipelineId: string): AutoMLPipeline | undefined;
    /** List all pipelines */
    listPipelines(): AutoMLPipeline[];
    /** Cancel a running pipeline */
    cancelPipeline(pipelineId: string): boolean;
}
//# sourceMappingURL=automl.d.ts.map