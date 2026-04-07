/**
 * ML/AutoML API routes for the gateway.
 */
import { Hono } from 'hono';
export function createMLRoutes(engine) {
    const ml = new Hono();
    // ─── Datasets ────────────────────────────────────────────
    /** GET /ml/datasets — list all loaded datasets */
    ml.get('/datasets', (c) => {
        return c.json({ datasets: engine.listDatasets() });
    });
    /** POST /ml/datasets/upload — upload CSV or JSON data */
    ml.post('/datasets/upload', async (c) => {
        const body = await c.req.json();
        if (!body.data || !body.format) {
            return c.json({ error: 'data and format are required' }, 400);
        }
        const dataset = body.format === 'csv'
            ? engine.loadCSV(body.data, { name: body.name })
            : engine.loadJSON(body.data, { name: body.name });
        return c.json({
            id: dataset.id,
            name: dataset.name,
            rows: dataset.rows.length,
            columns: dataset.columns,
            profile: dataset.profile,
        });
    });
    /** GET /ml/datasets/:id — get dataset details */
    ml.get('/datasets/:id', (c) => {
        const dataset = engine.getDataset(c.req.param('id'));
        if (!dataset)
            return c.json({ error: 'Dataset not found' }, 404);
        return c.json({
            id: dataset.id,
            name: dataset.name,
            source: dataset.source,
            columns: dataset.columns,
            rowCount: dataset.rows.length,
            profile: dataset.profile,
            createdAt: dataset.createdAt,
        });
    });
    /** GET /ml/datasets/:id/profile — profile a dataset */
    ml.get('/datasets/:id/profile', (c) => {
        const profile = engine.profileDataset(c.req.param('id'));
        if (!profile)
            return c.json({ error: 'Dataset not found' }, 404);
        return c.json({ profile });
    });
    /** DELETE /ml/datasets/:id */
    ml.delete('/datasets/:id', (c) => {
        const deleted = engine.deleteDataset(c.req.param('id'));
        return c.json({ deleted });
    });
    // ─── Algorithms ──────────────────────────────────────────
    /** GET /ml/algorithms — list all algorithms */
    ml.get('/algorithms', (c) => {
        const taskType = c.req.query('taskType');
        const algos = taskType ? engine.listAlgorithmsForTask(taskType) : engine.listAlgorithms();
        return c.json({
            algorithms: algos.map((a) => ({
                id: a.id,
                name: a.name,
                family: a.family,
                supportedTasks: a.supportedTasks,
                hyperparameters: a.hyperparameters,
                description: a.description,
            })),
        });
    });
    // ─── Training ────────────────────────────────────────────
    /** POST /ml/train — train a single model */
    ml.post('/train', async (c) => {
        const body = await c.req.json();
        if (!body.datasetId || !body.algorithmId || !body.targetColumn) {
            return c.json({ error: 'datasetId, algorithmId, and targetColumn are required' }, 400);
        }
        const model = engine.trainModel(body);
        if (!model)
            return c.json({ error: 'Training failed — check dataset/algorithm IDs' }, 400);
        return c.json({ model });
    });
    // ─── AutoML ──────────────────────────────────────────────
    /** POST /ml/automl — run AutoML pipeline */
    ml.post('/automl', async (c) => {
        const body = await c.req.json();
        if (!body.datasetId || !body.targetColumn || !body.taskType) {
            return c.json({ error: 'datasetId, targetColumn, and taskType are required' }, 400);
        }
        const pipeline = await engine.runAutoML(body.datasetId, {
            taskType: body.taskType,
            targetColumn: body.targetColumn,
            optimizeMetric: body.optimizeMetric ?? 'accuracy',
            maxTrials: body.maxTrials ?? 20,
            maxTimeSec: body.maxTimeSec ?? 300,
            algorithms: body.algorithms,
            strategy: body.strategy ?? 'random-search',
            cvFolds: body.cvFolds ?? 5,
            autoFeatureEngineering: body.autoFeatureEngineering ?? true,
            trainTestSplit: body.trainTestSplit ?? 0.8,
        }, { name: body.name });
        if (!pipeline)
            return c.json({ error: 'AutoML failed — check datasetId' }, 400);
        return c.json({ pipeline });
    });
    /** GET /ml/automl/:id — get AutoML pipeline status */
    ml.get('/automl/:id', (c) => {
        const pipeline = engine.automl.getPipeline(c.req.param('id'));
        if (!pipeline)
            return c.json({ error: 'Pipeline not found' }, 404);
        return c.json({ pipeline });
    });
    /** GET /ml/automl — list all pipelines */
    ml.get('/automl', (c) => {
        return c.json({ pipelines: engine.automl.listPipelines() });
    });
    // ─── Models ──────────────────────────────────────────────
    /** GET /ml/models — list trained models */
    ml.get('/models', (c) => {
        const taskType = c.req.query('taskType');
        const status = c.req.query('status');
        const models = engine.modelRegistry.list({
            taskType: taskType || undefined,
            status: status,
        });
        return c.json({ models });
    });
    /** GET /ml/models/:id — get model details */
    ml.get('/models/:id', (c) => {
        const model = engine.modelRegistry.get(c.req.param('id'));
        if (!model)
            return c.json({ error: 'Model not found' }, 404);
        return c.json({ model });
    });
    /** POST /ml/models/compare — compare models */
    ml.post('/models/compare', async (c) => {
        const body = await c.req.json();
        if (!body.modelIds?.length)
            return c.json({ error: 'modelIds required' }, 400);
        const comparison = engine.modelRegistry.compare(body.modelIds);
        return c.json({ comparison });
    });
    /** DELETE /ml/models/:id */
    ml.delete('/models/:id', (c) => {
        const deleted = engine.modelRegistry.delete(c.req.param('id'));
        return c.json({ deleted });
    });
    // ─── Summary ─────────────────────────────────────────────
    /** GET /ml/summary — engine status */
    ml.get('/summary', (c) => {
        return c.json(engine.getSummary());
    });
    return ml;
}
//# sourceMappingURL=ml.js.map