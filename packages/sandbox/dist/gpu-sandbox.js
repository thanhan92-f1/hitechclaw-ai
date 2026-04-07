// ============================================================
// GPU Sandbox — GPU-enabled sandbox configuration and bridge
// ============================================================
// Configures GPU-passthrough sandboxes for ML workloads.
// Provides a Python ML bridge for running training/inference
// inside sandboxed containers with GPU access.
import { POLICY_PERMISSIVE, registerBuiltinPolicy } from './policy-builder.js';
/** Pre-defined GPU sandbox images */
export const GPU_SANDBOX_IMAGES = [
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
export const POLICY_ML = {
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
export const POLICY_INFERENCE = {
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
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    /**
     * Create a GPU-enabled sandbox for a specific ML image.
     */
    async createMLSandbox(tenantId, imageName, options) {
        const imageConfig = GPU_SANDBOX_IMAGES.find((i) => i.name === imageName);
        if (!imageConfig) {
            throw new Error(`Unknown ML sandbox image: ${imageName}. Available: ${GPU_SANDBOX_IMAGES.map((i) => i.name).join(', ')}`);
        }
        const config = {
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
    async runPython(sandboxId, script) {
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
    async runInference(sandboxId, modelPath, inputData) {
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
        }
        catch {
            return { output: result.output, error: result.error };
        }
    }
    /**
     * List available ML sandbox images.
     */
    listImages() {
        return [...GPU_SANDBOX_IMAGES];
    }
}
//# sourceMappingURL=gpu-sandbox.js.map