import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

const HF_INFERENCE = 'https://api-inference.huggingface.co';
const HF_HUB = 'https://huggingface.co/api';

async function hfInference(model: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${HF_INFERENCE}/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace inference error ${res.status}: ${err}`);
  }
  return res.json();
}

async function hfHubGet(path: string, token: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${HF_HUB}${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace Hub error ${res.status}: ${err}`);
  }
  return res.json();
}

export const huggingfaceIntegration = defineIntegration({
  id: 'huggingface',
  name: 'Hugging Face',
  description: 'Access Hugging Face models, datasets, and Inference API for ML tasks',
  icon: '🤗',
  category: 'ai',

  auth: {
    type: 'bearer',
    fields: [
      {
        key: 'token',
        label: 'Hugging Face Token',
        type: 'secret',
        required: true,
        envVar: 'HUGGINGFACE_TOKEN',
        placeholder: 'hf_...',
      },
    ],
  },

  actions: [
    {
      name: 'inference',
      description: 'Run inference on a Hugging Face model via the Inference API',
      parameters: z.object({
        model: z.string().describe('Model ID, e.g. "facebook/bart-large-mnli"'),
        inputs: z.union([z.string(), z.array(z.string())]).describe('Input text or texts'),
        parameters: z.record(z.unknown()).optional().describe('Model-specific parameters'),
        task: z.enum([
          'text-classification',
          'token-classification',
          'question-answering',
          'summarization',
          'translation',
          'text-generation',
          'fill-mask',
          'sentence-similarity',
          'feature-extraction',
          'zero-shot-classification',
          'table-question-answering',
        ]).optional().describe('Task type'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const token = ctx.credentials.token;
        if (!token) return { success: false, error: 'HuggingFace token not configured' };
        try {
          const payload: Record<string, unknown> = { inputs: args.inputs };
          if (args.parameters) payload.parameters = args.parameters;
          const data = await hfInference(args.model, token, payload);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'HuggingFace inference failed' };
        }
      },
    },
    {
      name: 'list_models',
      description: 'Search for models on Hugging Face Hub',
      parameters: z.object({
        search: z.string().optional().describe('Search query'),
        author: z.string().optional(),
        filter: z.string().optional().describe('Filter by tag, e.g. "text-classification"'),
        sort: z.enum(['downloads', 'likes', 'trending', 'lastModified']).default('downloads'),
        limit: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const token = ctx.credentials.token;
        if (!token) return { success: false, error: 'HuggingFace token not configured' };
        try {
          const params: Record<string, string> = { sort: args.sort, limit: String(args.limit) };
          if (args.search) params.search = args.search;
          if (args.author) params.author = args.author;
          if (args.filter) params.filter = args.filter;
          const data = await hfHubGet('/models', token, params);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'HuggingFace list_models failed' };
        }
      },
    },
    {
      name: 'list_datasets',
      description: 'Search for datasets on Hugging Face Hub',
      parameters: z.object({
        search: z.string().optional().describe('Search query'),
        author: z.string().optional(),
        filter: z.string().optional().describe('Filter by tag'),
        sort: z.enum(['downloads', 'likes', 'trending', 'lastModified']).default('downloads'),
        limit: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const token = ctx.credentials.token;
        if (!token) return { success: false, error: 'HuggingFace token not configured' };
        try {
          const params: Record<string, string> = { sort: args.sort, limit: String(args.limit) };
          if (args.search) params.search = args.search;
          if (args.author) params.author = args.author;
          if (args.filter) params.filter = args.filter;
          const data = await hfHubGet('/datasets', token, params);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'HuggingFace list_datasets failed' };
        }
      },
    },
    {
      name: 'get_model_info',
      description: 'Get detailed information about a specific model',
      parameters: z.object({
        model: z.string().describe('Model ID, e.g. "bert-base-uncased"'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const token = ctx.credentials.token;
        if (!token) return { success: false, error: 'HuggingFace token not configured' };
        try {
          const data = await hfHubGet(`/models/${args.model}`, token);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'HuggingFace get_model_info failed' };
        }
      },
    },
    {
      name: 'text_embedding',
      description: 'Generate text embeddings using a Hugging Face model',
      parameters: z.object({
        model: z.string().default('sentence-transformers/all-MiniLM-L6-v2').describe('Embedding model'),
        inputs: z.array(z.string()).describe('Texts to embed'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        const token = ctx.credentials.token;
        if (!token) return { success: false, error: 'HuggingFace token not configured' };
        try {
          const data = await hfInference(args.model, token, { inputs: args.inputs });
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'HuggingFace text_embedding failed' };
        }
      },
    },
  ],
});
