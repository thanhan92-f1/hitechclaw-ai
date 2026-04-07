import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

const WANDB_API = 'https://api.wandb.ai/api/v1';

async function wandbRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${WANDB_API}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const auth = `Basic ${btoa(`api:${apiKey}`)}`;
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`W&B API error ${res.status}: ${err}`);
  }
  return res.json();
}

export const wandbIntegration = defineIntegration({
  id: 'wandb',
  name: 'Weights & Biases',
  description: 'Track ML experiments, log metrics, and manage model artifacts with W&B',
  icon: '📊',
  category: 'ai',

  auth: {
    type: 'api-key',
    fields: [
      {
        key: 'apiKey',
        label: 'W&B API Key',
        type: 'secret',
        required: true,
        envVar: 'WANDB_API_KEY',
        placeholder: 'wandb-api-key...',
      },
      {
        key: 'entity',
        label: 'W&B Entity (team or user)',
        type: 'string',
        required: false,
        envVar: 'WANDB_ENTITY',
        placeholder: 'my-team',
      },
    ],
  },

  actions: [
    {
      name: 'log_run',
      description: 'Log metrics for an ML training run',
      parameters: z.object({
        project: z.string().describe('W&B project name'),
        runName: z.string().optional().describe('Run name'),
        metrics: z.record(z.number()).describe('Metrics to log, e.g. {"accuracy": 0.95, "loss": 0.1}'),
        config: z.record(z.unknown()).optional().describe('Run configuration/hyperparameters'),
        tags: z.array(z.string()).optional().describe('Tags for the run'),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        const apiKey = ctx.credentials.apiKey;
        const entity = ctx.credentials.entity;
        if (!apiKey) return { success: false, error: 'W&B API key not configured' };
        if (!entity) return { success: false, error: 'W&B entity not configured' };
        try {
          // Create run then update its summary with metrics
          const runBody: Record<string, unknown> = { project: args.project };
          if (args.runName) runBody.display_name = args.runName;
          if (args.config) runBody.config = args.config;
          if (args.tags) runBody.tags = args.tags;
          const run = await wandbRequest('POST', `/${entity}/${args.project}/runs`, apiKey, runBody) as Record<string, unknown>;
          const runId = (run.name ?? run.id) as string;
          await wandbRequest('PUT', `/${entity}/${args.project}/runs/${runId}/summary`, apiKey, { summary: args.metrics });
          return { success: true, data: { runId, url: `https://wandb.ai/${entity}/${args.project}/runs/${runId}` } };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'W&B log_run failed' };
        }
      },
    },
    {
      name: 'list_runs',
      description: 'List runs in a W&B project',
      parameters: z.object({
        project: z.string().describe('W&B project name'),
        filters: z.record(z.unknown()).optional().describe('Filter criteria'),
        order: z.string().optional().default('-created_at'),
        perPage: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const apiKey = ctx.credentials.apiKey;
        const entity = ctx.credentials.entity;
        if (!apiKey) return { success: false, error: 'W&B API key not configured' };
        if (!entity) return { success: false, error: 'W&B entity not configured' };
        try {
          const params: Record<string, string> = { perPage: String(args.perPage), order: args.order ?? '-created_at' };
          if (args.filters) params.filters = JSON.stringify(args.filters);
          const data = await wandbRequest('GET', `/${entity}/${args.project}/runs`, apiKey, undefined, params);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'W&B list_runs failed' };
        }
      },
    },
    {
      name: 'get_run',
      description: 'Get detailed metrics and artifacts for a specific run',
      parameters: z.object({
        project: z.string(),
        runId: z.string().describe('Run ID'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const apiKey = ctx.credentials.apiKey;
        const entity = ctx.credentials.entity;
        if (!apiKey) return { success: false, error: 'W&B API key not configured' };
        if (!entity) return { success: false, error: 'W&B entity not configured' };
        try {
          const data = await wandbRequest('GET', `/${entity}/${args.project}/runs/${args.runId}`, apiKey);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'W&B get_run failed' };
        }
      },
    },
    {
      name: 'log_artifact',
      description: 'Log a model or dataset as a W&B artifact',
      parameters: z.object({
        project: z.string(),
        name: z.string().describe('Artifact name'),
        type: z.enum(['model', 'dataset', 'result']).describe('Artifact type'),
        description: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        const apiKey = ctx.credentials.apiKey;
        const entity = ctx.credentials.entity;
        if (!apiKey) return { success: false, error: 'W&B API key not configured' };
        if (!entity) return { success: false, error: 'W&B entity not configured' };
        try {
          const body: Record<string, unknown> = {
            name: args.name,
            type: args.type,
          };
          if (args.description) body.description = args.description;
          if (args.metadata) body.metadata = args.metadata;
          const data = await wandbRequest('POST', `/${entity}/${args.project}/artifacts`, apiKey, body);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'W&B log_artifact failed' };
        }
      },
    },
    {
      name: 'create_report',
      description: 'Create a W&B report comparing runs',
      parameters: z.object({
        project: z.string(),
        title: z.string(),
        runIds: z.array(z.string()).optional().describe('Runs to include'),
        description: z.string().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        const apiKey = ctx.credentials.apiKey;
        const entity = ctx.credentials.entity;
        if (!apiKey) return { success: false, error: 'W&B API key not configured' };
        if (!entity) return { success: false, error: 'W&B entity not configured' };
        try {
          // W&B reports are created via GraphQL
          const query = `mutation CreateReport($input: CreateViewInput!) {
            createView(input: $input) { view { id displayName } }
          }`;
          const variables = {
            input: {
              entityName: entity,
              projectName: args.project,
              name: args.title,
              description: args.description ?? '',
              type: 'runs',
            },
          };
          const res = await fetch('https://api.wandb.ai/graphql', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.timeout(15_000),
          });
          const data = await res.json() as Record<string, unknown>;
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'W&B create_report failed' };
        }
      },
    },
  ],
});
