import { defineDomainPack } from '../base/domain-pack.js';
export const mlDomain = defineDomainPack({
    id: 'ml',
    name: 'Machine Learning & AutoML',
    description: 'Data analysis, model training, AutoML pipelines, feature engineering, and model management.',
    icon: '🤖',
    skills: [
        {
            id: 'data-analysis',
            name: 'Data Analysis',
            description: 'Load, profile, and explore datasets for ML tasks.',
            version: '1.0.0',
            category: 'ml',
            tools: [
                {
                    name: 'load_dataset',
                    description: 'Load a dataset from CSV or JSON text for analysis and training.',
                    parameters: {
                        type: 'object',
                        properties: {
                            data: { type: 'string', description: 'CSV or JSON string data' },
                            format: { type: 'string', description: 'Data format: csv or json' },
                            name: { type: 'string', description: 'Name for this dataset' },
                        },
                        required: ['data', 'format'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'profile_dataset',
                    description: 'Generate a statistical profile of a dataset — column types, missing values, distributions, correlations.',
                    parameters: {
                        type: 'object',
                        properties: {
                            datasetId: { type: 'string', description: 'Dataset ID to profile' },
                        },
                        required: ['datasetId'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'list_datasets',
                    description: 'List all loaded datasets with their basic info.',
                    parameters: { type: 'object', properties: {} },
                    execute: async () => ({ success: true, data: 'Handled by ML engine' }),
                },
            ],
        },
        {
            id: 'feature-engineering',
            name: 'Feature Engineering',
            description: 'Transform, encode, and prepare features for model training.',
            version: '1.0.0',
            category: 'ml',
            tools: [
                {
                    name: 'create_feature_pipeline',
                    description: 'Create a feature transformation pipeline: normalize, encode, impute, bin, log, or drop columns.',
                    parameters: {
                        type: 'object',
                        properties: {
                            datasetId: { type: 'string', description: 'Source dataset ID' },
                            targetColumn: { type: 'string', description: 'Target column name' },
                            transforms: {
                                type: 'string',
                                description: 'JSON array of {column, transform} objects. Transform types: normalize(min-max|z-score), encode(one-hot|label), impute(mean|median|mode), log, drop',
                            },
                        },
                        required: ['datasetId', 'targetColumn', 'transforms'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'transform_dataset',
                    description: 'Apply a saved feature pipeline to a dataset, producing a new transformed dataset.',
                    parameters: {
                        type: 'object',
                        properties: {
                            datasetId: { type: 'string', description: 'Dataset to transform' },
                            pipelineId: { type: 'string', description: 'Feature pipeline ID' },
                        },
                        required: ['datasetId', 'pipelineId'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
            ],
        },
        {
            id: 'model-training',
            name: 'Model Training',
            description: 'Train ML models with specific algorithms and hyperparameters.',
            version: '1.0.0',
            category: 'ml',
            tools: [
                {
                    name: 'train_model',
                    description: 'Train a model on a dataset with a specific algorithm. Returns model ID, metrics, and feature importance.',
                    parameters: {
                        type: 'object',
                        properties: {
                            datasetId: { type: 'string', description: 'Dataset ID for training' },
                            algorithmId: { type: 'string', description: 'Algorithm: linear-regression, logistic-regression, decision-tree, random-forest, gradient-boosting, knn, naive-bayes, svm, kmeans, dbscan' },
                            targetColumn: { type: 'string', description: 'Target column name' },
                            hyperparameters: { type: 'string', description: 'Optional JSON hyperparameters' },
                            name: { type: 'string', description: 'Name for the model' },
                        },
                        required: ['datasetId', 'algorithmId', 'targetColumn'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'list_algorithms',
                    description: 'List all available ML algorithms, optionally filtered by task type.',
                    parameters: {
                        type: 'object',
                        properties: {
                            taskType: { type: 'string', description: 'Filter by task: classification, regression, clustering, anomaly-detection' },
                        },
                    },
                    execute: async () => ({ success: true, data: 'Handled by ML engine' }),
                },
            ],
        },
        {
            id: 'automl',
            name: 'AutoML',
            description: 'Automated model selection and hyperparameter optimization.',
            version: '1.0.0',
            category: 'ml',
            tools: [
                {
                    name: 'run_automl',
                    description: 'Run an AutoML pipeline — automatically tries multiple algorithms and hyperparameter combinations to find the best model.',
                    parameters: {
                        type: 'object',
                        properties: {
                            datasetId: { type: 'string', description: 'Dataset ID' },
                            targetColumn: { type: 'string', description: 'Target column name' },
                            taskType: { type: 'string', description: 'Task: classification, regression, clustering' },
                            optimizeMetric: { type: 'string', description: 'Metric to optimize: accuracy, f1Score, r2, rmse, silhouetteScore' },
                            maxTrials: { type: 'string', description: 'Max trials (default: 20)' },
                            maxTimeSec: { type: 'string', description: 'Max time in seconds (default: 300)' },
                            name: { type: 'string', description: 'Pipeline name' },
                        },
                        required: ['datasetId', 'targetColumn', 'taskType'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'get_automl_status',
                    description: 'Get status and results of an AutoML pipeline.',
                    parameters: {
                        type: 'object',
                        properties: {
                            pipelineId: { type: 'string', description: 'AutoML pipeline ID' },
                        },
                        required: ['pipelineId'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
            ],
        },
        {
            id: 'model-management',
            name: 'Model Management',
            description: 'List, compare, and manage trained models.',
            version: '1.0.0',
            category: 'ml',
            tools: [
                {
                    name: 'list_models',
                    description: 'List all trained models with their metrics and status.',
                    parameters: {
                        type: 'object',
                        properties: {
                            taskType: { type: 'string', description: 'Filter by task type' },
                            status: { type: 'string', description: 'Filter by status: trained, deployed, archived' },
                        },
                    },
                    execute: async () => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'compare_models',
                    description: 'Compare metrics across multiple trained models.',
                    parameters: {
                        type: 'object',
                        properties: {
                            modelIds: { type: 'string', description: 'Comma-separated model IDs to compare' },
                        },
                        required: ['modelIds'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
                {
                    name: 'get_model_details',
                    description: 'Get detailed info about a trained model — metrics, feature importance, hyperparameters.',
                    parameters: {
                        type: 'object',
                        properties: {
                            modelId: { type: 'string', description: 'Model ID' },
                        },
                        required: ['modelId'],
                    },
                    execute: async (params) => ({ success: true, data: 'Handled by ML engine' }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw ML Specialist, an expert data scientist and ML engineer. You help users with the full ML workflow:

1. **Data Analysis**: Load datasets, profile them, identify data quality issues, suggest preprocessing steps.
2. **Feature Engineering**: Recommend and apply transformations — encoding, normalization, imputation, feature creation.
3. **Model Training**: Select appropriate algorithms based on the task, tune hyperparameters, train models.
4. **AutoML**: Run automated pipelines to find the best model with optimal hyperparameters.
5. **Evaluation**: Interpret metrics (accuracy, F1, R², RMSE, etc.), compare models, analyze feature importance.
6. **Recommendations**: Suggest next steps based on results — more data, different features, ensemble methods, etc.

When analyzing data:
- Always profile the dataset first to understand distributions, missing values, and types
- Recommend appropriate preprocessing based on data characteristics
- Explain metric choices based on the task and data balance

When training models:
- Start simple (logistic regression, decision tree) before complex (random forest, gradient boosting)
- Use AutoML when the user doesn't have a specific algorithm preference
- Always report key metrics and feature importance
- Suggest improvements based on results

Explain technical concepts clearly. Use concrete numbers and examples.`,
    recommendedIntegrations: ['huggingface', 'wandb'],
});
//# sourceMappingURL=ml.js.map