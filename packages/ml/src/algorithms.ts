/**
 * Built-in algorithm catalog.
 * These are the algorithms the ML engine can "train" using
 * pure TypeScript implementations or delegating to external runtimes.
 */
import type { Algorithm } from './types.js';

export const algorithms: Algorithm[] = [
  // ─── Linear Models ───────────────────────────────────────
  {
    id: 'linear-regression',
    name: 'Linear Regression',
    family: 'linear',
    supportedTasks: ['regression'],
    hyperparameters: [
      { name: 'learningRate', type: 'float', default: 0.01, min: 0.0001, max: 1.0, description: 'Step size for gradient descent' },
      { name: 'epochs', type: 'int', default: 100, min: 10, max: 10000, description: 'Training iterations' },
      { name: 'regularization', type: 'categorical', default: 'none', choices: ['none', 'l1', 'l2'], description: 'Regularization type' },
      { name: 'alpha', type: 'float', default: 0.01, min: 0.0, max: 10.0, description: 'Regularization strength' },
    ],
    description: 'Standard linear regression with optional L1/L2 regularization.',
  },
  {
    id: 'logistic-regression',
    name: 'Logistic Regression',
    family: 'linear',
    supportedTasks: ['classification'],
    hyperparameters: [
      { name: 'learningRate', type: 'float', default: 0.01, min: 0.0001, max: 1.0, description: 'Step size for gradient descent' },
      { name: 'epochs', type: 'int', default: 100, min: 10, max: 10000, description: 'Training iterations' },
      { name: 'regularization', type: 'categorical', default: 'l2', choices: ['none', 'l1', 'l2'], description: 'Regularization type' },
      { name: 'C', type: 'float', default: 1.0, min: 0.001, max: 1000, description: 'Inverse regularization strength' },
    ],
    description: 'Logistic regression for binary and multi-class classification.',
  },

  // ─── Tree Models ─────────────────────────────────────────
  {
    id: 'decision-tree',
    name: 'Decision Tree',
    family: 'tree',
    supportedTasks: ['classification', 'regression'],
    hyperparameters: [
      { name: 'maxDepth', type: 'int', default: 10, min: 1, max: 50, description: 'Maximum tree depth' },
      { name: 'minSamplesSplit', type: 'int', default: 2, min: 2, max: 100, description: 'Minimum samples to split a node' },
      { name: 'minSamplesLeaf', type: 'int', default: 1, min: 1, max: 50, description: 'Minimum samples in a leaf' },
      { name: 'criterion', type: 'categorical', default: 'gini', choices: ['gini', 'entropy', 'mse', 'mae'], description: 'Split criterion' },
    ],
    description: 'Decision tree that can be used for both classification and regression.',
  },

  // ─── Ensemble Models ─────────────────────────────────────
  {
    id: 'random-forest',
    name: 'Random Forest',
    family: 'ensemble',
    supportedTasks: ['classification', 'regression'],
    hyperparameters: [
      { name: 'nEstimators', type: 'int', default: 100, min: 10, max: 1000, description: 'Number of trees' },
      { name: 'maxDepth', type: 'int', default: 10, min: 1, max: 50, description: 'Maximum tree depth' },
      { name: 'minSamplesSplit', type: 'int', default: 2, min: 2, max: 100, description: 'Minimum samples to split' },
      { name: 'maxFeatures', type: 'categorical', default: 'sqrt', choices: ['sqrt', 'log2', 'all'], description: 'Max features per split' },
      { name: 'bootstrap', type: 'boolean', default: true, description: 'Whether to use bootstrap samples' },
    ],
    description: 'Ensemble of decision trees with bagging for robust predictions.',
  },
  {
    id: 'gradient-boosting',
    name: 'Gradient Boosting',
    family: 'ensemble',
    supportedTasks: ['classification', 'regression'],
    hyperparameters: [
      { name: 'nEstimators', type: 'int', default: 100, min: 10, max: 2000, description: 'Number of boosting rounds' },
      { name: 'learningRate', type: 'float', default: 0.1, min: 0.001, max: 1.0, description: 'Shrinkage rate' },
      { name: 'maxDepth', type: 'int', default: 6, min: 1, max: 20, description: 'Maximum tree depth' },
      { name: 'subsample', type: 'float', default: 0.8, min: 0.1, max: 1.0, description: 'Row sampling ratio' },
      { name: 'colsampleBytree', type: 'float', default: 0.8, min: 0.1, max: 1.0, description: 'Column sampling ratio' },
      { name: 'minChildWeight', type: 'int', default: 1, min: 1, max: 20, description: 'Minimum child weight' },
    ],
    description: 'Gradient boosted decision trees (XGBoost-style).',
  },

  // ─── KNN ─────────────────────────────────────────────────
  {
    id: 'knn',
    name: 'K-Nearest Neighbors',
    family: 'knn',
    supportedTasks: ['classification', 'regression'],
    hyperparameters: [
      { name: 'k', type: 'int', default: 5, min: 1, max: 100, description: 'Number of neighbors' },
      { name: 'weights', type: 'categorical', default: 'uniform', choices: ['uniform', 'distance'], description: 'Weight function' },
      { name: 'metric', type: 'categorical', default: 'euclidean', choices: ['euclidean', 'manhattan', 'cosine'], description: 'Distance metric' },
    ],
    description: 'K-nearest neighbors — simple instance-based learning.',
  },

  // ─── Naive Bayes ─────────────────────────────────────────
  {
    id: 'naive-bayes',
    name: 'Naive Bayes',
    family: 'naive-bayes',
    supportedTasks: ['classification', 'nlp-classification'],
    hyperparameters: [
      { name: 'variant', type: 'categorical', default: 'gaussian', choices: ['gaussian', 'multinomial', 'bernoulli'], description: 'Naive Bayes variant' },
      { name: 'alpha', type: 'float', default: 1.0, min: 0.0, max: 10.0, description: 'Smoothing parameter' },
    ],
    description: 'Probabilistic classifier based on Bayes theorem.',
  },

  // ─── SVM ─────────────────────────────────────────────────
  {
    id: 'svm',
    name: 'Support Vector Machine',
    family: 'svm',
    supportedTasks: ['classification', 'regression'],
    hyperparameters: [
      { name: 'kernel', type: 'categorical', default: 'rbf', choices: ['linear', 'rbf', 'poly', 'sigmoid'], description: 'Kernel type' },
      { name: 'C', type: 'float', default: 1.0, min: 0.001, max: 1000, description: 'Regularization parameter' },
      { name: 'gamma', type: 'categorical', default: 'scale', choices: ['scale', 'auto'], description: 'Kernel coefficient' },
      { name: 'degree', type: 'int', default: 3, min: 2, max: 5, description: 'Degree for poly kernel' },
    ],
    description: 'SVM for classification and regression tasks.',
  },

  // ─── Clustering ──────────────────────────────────────────
  {
    id: 'kmeans',
    name: 'K-Means Clustering',
    family: 'clustering',
    supportedTasks: ['clustering'],
    hyperparameters: [
      { name: 'nClusters', type: 'int', default: 3, min: 2, max: 100, description: 'Number of clusters' },
      { name: 'maxIter', type: 'int', default: 300, min: 10, max: 1000, description: 'Maximum iterations' },
      { name: 'init', type: 'categorical', default: 'kmeans++', choices: ['kmeans++', 'random'], description: 'Initialization method' },
      { name: 'nInit', type: 'int', default: 10, min: 1, max: 50, description: 'Number of init runs' },
    ],
    description: 'K-Means clustering to partition data into K groups.',
  },
  {
    id: 'dbscan',
    name: 'DBSCAN',
    family: 'clustering',
    supportedTasks: ['clustering', 'anomaly-detection'],
    hyperparameters: [
      { name: 'eps', type: 'float', default: 0.5, min: 0.01, max: 100, description: 'Maximum distance between neighbors' },
      { name: 'minSamples', type: 'int', default: 5, min: 1, max: 100, description: 'Minimum samples in a neighborhood' },
      { name: 'metric', type: 'categorical', default: 'euclidean', choices: ['euclidean', 'manhattan', 'cosine'], description: 'Distance metric' },
    ],
    description: 'Density-based clustering that finds arbitrarily shaped clusters.',
  },

  // ─── Dimensionality Reduction ────────────────────────────
  {
    id: 'pca',
    name: 'PCA',
    family: 'dimensionality-reduction',
    supportedTasks: ['clustering'],
    hyperparameters: [
      { name: 'nComponents', type: 'int', default: 2, min: 1, max: 100, description: 'Number of components' },
      { name: 'whiten', type: 'boolean', default: false, description: 'Whether to whiten components' },
    ],
    description: 'Principal Component Analysis for dimensionality reduction.',
  },

  // ─── Anomaly Detection ───────────────────────────────────
  {
    id: 'isolation-forest',
    name: 'Isolation Forest',
    family: 'ensemble',
    supportedTasks: ['anomaly-detection'],
    hyperparameters: [
      { name: 'nEstimators', type: 'int', default: 100, min: 10, max: 1000, description: 'Number of trees' },
      { name: 'contamination', type: 'float', default: 0.1, min: 0.01, max: 0.5, description: 'Expected outlier fraction' },
      { name: 'maxSamples', type: 'categorical', default: 'auto', choices: ['auto', '256', '512', '1024'], description: 'Samples per tree' },
    ],
    description: 'Isolation forest for unsupervised anomaly detection.',
  },
];

/**
 * Get all algorithms that support a given task type.
 */
export function getAlgorithmsForTask(taskType: string): Algorithm[] {
  return algorithms.filter((a) => a.supportedTasks.includes(taskType as never));
}

/**
 * Get algorithm definition by ID.
 */
export function getAlgorithm(algorithmId: string): Algorithm | undefined {
  return algorithms.find((a) => a.id === algorithmId);
}
