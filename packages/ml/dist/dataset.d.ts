/**
 * Dataset Manager — Parse, profile, split, and transform datasets.
 */
import type { Dataset, DatasetProfile, DataSplit, FeaturePipeline } from './types.js';
/**
 * Parse CSV text into a Dataset.
 */
export declare function parseCSV(csv: string, options?: {
    delimiter?: string;
    name?: string;
}): Dataset;
/**
 * Parse JSON array into a Dataset.
 */
export declare function parseJSON(json: string, options?: {
    name?: string;
}): Dataset;
/**
 * Profile a dataset — compute stats for each column.
 */
export declare function profileDataset(dataset: Dataset): DatasetProfile;
/**
 * Split dataset into train/test (and optional validation).
 */
export declare function splitDataset(dataset: Dataset, ratios?: [number, number] | [number, number, number], options?: {
    shuffle?: boolean;
    seed?: number;
    stratifyColumn?: string;
}): DataSplit;
/**
 * Apply a feature pipeline to transform data columns.
 */
export declare function applyFeaturePipeline(dataset: Dataset, pipeline: FeaturePipeline): {
    transformedRows: unknown[][];
    newColumns: string[];
};
//# sourceMappingURL=dataset.d.ts.map