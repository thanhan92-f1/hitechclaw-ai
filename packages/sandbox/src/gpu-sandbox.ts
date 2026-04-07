// ============================================================
// GPU Sandbox — GPU-enabled sandbox configuration and bridge
// ============================================================
// Configures GPU-passthrough sandboxes for ML workloads.
// Provides a Python ML bridge for running training/inference
// inside sandboxed containers with GPU access.

import type { SandboxConfig, SandboxPolicy } from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';
import { POLICY_PERMISSIVE, registerBuiltinPolicy } from './policy-builder.js';

/** GPU sandbox image configuration */
export interface GPUSandboxImage {
  /** Image name */
  name: string;
  /** Description */
  description: string;
  /** Base container image */
  image: string;
  /** Required CUDA version */
  cudaVersion?: string;
  /** Pre-installed packages */
  packages: string[];
  /** Whether GPU is required */
  gpuRequired: boolean;
}

/** Pre-defined GPU sandbox images */
export const GPU_SANDBOX_IMAGES: GPUSandboxImage[] = [
  {
    name: 'ml-pytorch',
    description: 'PyTorch + CUDA for deep learning',
    image: 'hitechclaw/sandbox-pytorch:latest',
    cudaVersion: '12.4',
    packages: ['torch', 'torchvision', 'numpy', 'pandas', 'scikit-learn'],
    gpuRequired: true,
  },
  {
    name: 'ml-tensorflow',
    description: 'TensorFlow + CUDA for deep learning',
    image: 'hitechclaw/sandbox-tensorflow:latest',
    cudaVersion: '12.4',
    packages: ['tensorflow', 'numpy', 'pandas', 'scikit-learn'],
    gpuRequired: true,
  },
  {
    name: 'ml-sklearn',
    description: 'Scikit-learn for classical ML (CPU only)',
    image: 'hitechclaw/sandbox-sklearn:latest',
    packages: ['scikit-learn', 'numpy', 'pandas', 'xgboost', 'lightgbm'],
    gpuRequired: false,
  },
  {
    name: 'ml-huggingface',
    description: 'Hugging Face Transformers + CUDA',
    image: 'hitechclaw/sandbox-hf:latest',
    cudaVersion: '12.4',
    packages: ['transformers', 'torch', 'tokenizers', 'accelerate', 'datasets'],
    gpuRequired: true,
  },
  {
    name: 'inference-onnx',
    description: 'ONNX Runtime for optimized inference',
    image: 'hitechclaw/sandbox-onnx:latest',
    packages: ['onnxruntime', 'numpy'],
    gpuRequired: false,
  },
];

/** Policy for ML workloads — more permissive for model downloads */
export const POLICY_ML: SandboxPolicy = {
  ...POLICY_PERMISSIVE,
  name: 'ml',
  network: {
    rules: [
      // Allow model downloads from common registries
      { host: 'huggingface.co', allow: true },
      { host: '*.huggingface.co', allow: true },
      { host: 'cdn-lfs.huggingface.co', allow: true },
      { host: 'pypi.org', methods: ['GET'], allow: true },
      { host: 'files.pythonhosted.org', methods: ['GET'], allow: true },
    ],
    defaultAction: 'deny',
  },
  process: {
    allowPrivilegeEscalation: false,
    maxProcesses: 100, // ML workloads need more processes
  },
};

/** Policy for inference-only (no model training, stricter) */
export const POLICY_INFERENCE: SandboxPolicy = {
  ...POLICY_PERMISSIVE,
  name: 'inference',
  network: {
    rules: [],
    defaultAction: 'deny',
  },
  process: {
    allowPrivilegeEscalation: false,
    maxProcesses: 30,
  },
};

// Register ML/Inference policies into the global builtin map
registerBuiltinPolicy('ml', POLICY_ML);
registerBuiltinPolicy('inference', POLICY_INFERENCE);

/**
 * GPUSandboxBridge — Creates and manages GPU-enabled sandboxes
 * for ML training and inference workloads.
 */
export class GPUSandboxBridge {
  constructor(private readonly manager: SandboxManager) {}

  /**
   * Create a GPU-enabled sandbox for a specific ML image.
   */
  async createMLSandbox(
    tenantId: string,
    imageName: string,
    options?: { gpu?: boolean; memoryLimit?: string; cpuLimit?: string },
  ): Promise<string> {
    const imageConfig = GPU_SANDBOX_IMAGES.find((i) => i.name === imageName);
    if (!imageConfig) {
      throw new Error(`Unknown ML sandbox image: ${imageName}. Available: ${GPU_SANDBOX_IMAGES.map((i) => i.name).join(', ')}`);
    }

    const config: SandboxConfig = {
      id: `ml-${Date.now()}`,
      name: `ml-${imageName}-${tenantId.slice(0, 8)}`,
      tenantId,
      image: imageConfig.image,
      policy: POLICY_ML,
      gpu: options?.gpu ?? imageConfig.gpuRequired,
      resources: {
        cpuLimit: options?.cpuLimit ?? '2.0',
        memoryLimit: options?.memoryLimit ?? '4Gi',
      },
      timeoutMs: 600_000, // 10 min for ML workloads
    };

    const instance = await this.manager.create(config);
    return instance.id;
  }

  /**
   * Run a Python script inside an ML sandbox.
   */
  async runPython(sandboxId: string, script: string): Promise<{ output: string; error?: string }> {
    // Write script to file and execute
    const escaped = script.replace(/'/g, "'\\''");
    const command = `python3 -c '${escaped}'`;
    const result = await this.manager.execute(sandboxId, command);
    return {
      output: String(result.output ?? ''),
      error: result.stderr,
    };
  }

  /**
   * Run inference on a pre-loaded model inside a sandbox.
   */
  async runInference(
    sandboxId: string,
    modelPath: string,
    inputData: Record<string, unknown>,
  ): Promise<unknown> {
    const inputJson = JSON.stringify(inputData);
    const script = `
import json, sys
input_data = json.loads('${inputJson.replace(/'/g, "\\'")}')
# Model loading and inference would happen here
# For now return a placeholder
result = {"status": "inference_complete", "model": "${modelPath}", "input_shape": len(input_data)}
print(json.dumps(result))
`;
    const result = await this.runPython(sandboxId, script);
    try {
      return JSON.parse(result.output);
    } catch {
      return { output: result.output, error: result.error };
    }
  }

  /**
   * List available ML sandbox images.
   */
  listImages(): GPUSandboxImage[] {
    return [...GPU_SANDBOX_IMAGES];
  }
}
