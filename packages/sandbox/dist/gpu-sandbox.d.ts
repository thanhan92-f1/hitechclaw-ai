import type { SandboxPolicy } from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';
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
export declare const GPU_SANDBOX_IMAGES: GPUSandboxImage[];
/** Policy for ML workloads — more permissive for model downloads */
export declare const POLICY_ML: SandboxPolicy;
/** Policy for inference-only (no model training, stricter) */
export declare const POLICY_INFERENCE: SandboxPolicy;
/**
 * GPUSandboxBridge — Creates and manages GPU-enabled sandboxes
 * for ML training and inference workloads.
 */
export declare class GPUSandboxBridge {
    private readonly manager;
    constructor(manager: SandboxManager);
    /**
     * Create a GPU-enabled sandbox for a specific ML image.
     */
    createMLSandbox(tenantId: string, imageName: string, options?: {
        gpu?: boolean;
        memoryLimit?: string;
        cpuLimit?: string;
    }): Promise<string>;
    /**
     * Run a Python script inside an ML sandbox.
     */
    runPython(sandboxId: string, script: string): Promise<{
        output: string;
        error?: string;
    }>;
    /**
     * Run inference on a pre-loaded model inside a sandbox.
     */
    runInference(sandboxId: string, modelPath: string, inputData: Record<string, unknown>): Promise<unknown>;
    /**
     * List available ML sandbox images.
     */
    listImages(): GPUSandboxImage[];
}
//# sourceMappingURL=gpu-sandbox.d.ts.map