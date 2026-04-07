// @hitechclaw/ml — ML/AutoML Engine
// Dataset management, model training, AutoML pipelines, model registry

export { MLEngine } from './engine.js';
export { AutoMLEngine } from './automl.js';
export { ModelRegistry } from './model-registry.js';
export { algorithms, getAlgorithmsForTask, getAlgorithm } from './algorithms.js';
export { parseCSV, parseJSON, profileDataset, splitDataset, applyFeaturePipeline } from './dataset.js';
export { trainModel } from './trainers.js';

// Reinforcement Learning
export { BanditSelector } from './reinforcement.js';

// Types
export type {
  // Dataset
  Dataset,
  DatasetProfile,
  ColumnSchema,
  DataType,
  NumericStats,
  DataSplit,
  // Features
  FeaturePipeline,
  FeatureTransform,
  // Model
  TaskType,
  AlgorithmFamily,
  Algorithm,
  HyperparameterDef,
  Hyperparameters,
  TrainedModel,
  ModelStatus,
  ModelMetrics,
  ClassificationMetrics,
  RegressionMetrics,
  ClusteringMetrics,
  // AutoML
  AutoMLConfig,
  AutoMLStrategy,
  AutoMLPipeline,
  AutoMLTrial,
  PipelineStatus,
  // Prediction
  PredictionRequest,
  PredictionResult,
  // Reinforcement Learning
  BanditStrategy,
  ArmStats,
  BanditConfig,
  BanditState,
  RewardSignal,
  MessageFeedback,
  // Events
  MLEngineEvents,
} from './types.js';
