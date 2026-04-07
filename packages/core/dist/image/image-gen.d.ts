/**
 * Image Generation Service — Multi-provider support
 *
 * Providers:
 *   - replicate   — Best quality (FLUX, SDXL, Stable Diffusion 3.5)
 *   - together    — Fast + cheap (FLUX Schnell, FLUX Pro)
 *   - comfyui     — Local Stable Diffusion (free, requires GPU)
 *   - placeholder — SVG/Canvas mock for dev mode (no GPU needed)
 */
export interface ImageGenConfig {
    provider: 'gemini' | 'replicate' | 'together' | 'comfyui' | 'placeholder';
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
}
export interface ImageGenRequest {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    model?: string;
    steps?: number;
    guidanceScale?: number;
    seed?: number;
    /** Number of images to generate */
    count?: number;
    /** Style preset (for fashion/t-shirt use) */
    style?: string;
}
export interface ImageGenResult {
    images: GeneratedImage[];
    model: string;
    provider: string;
    durationMs: number;
}
export interface GeneratedImage {
    /** Base64-encoded image data (data:image/png;base64,...) */
    url: string;
    width: number;
    height: number;
    seed?: number;
}
export declare const IMAGE_MODELS: {
    readonly gemini: readonly [{
        readonly id: "imagen-4-ultra-generate-exp-05-20";
        readonly name: "Imagen 4 Ultra (exp)";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.06/img";
    }, {
        readonly id: "imagen-4-generate-exp-05-20";
        readonly name: "Imagen 4 (exp)";
        readonly quality: "great";
        readonly speed: "fast";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "imagen-3.0-generate-002";
        readonly name: "Imagen 3";
        readonly quality: "great";
        readonly speed: "fast";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "imagen-3.0-fast-generate-001";
        readonly name: "Imagen 3 Fast";
        readonly quality: "good";
        readonly speed: "fastest";
        readonly cost: "$0.02/img";
    }];
    readonly replicate: readonly [{
        readonly id: "black-forest-labs/flux-1.1-pro";
        readonly name: "FLUX 1.1 Pro";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "black-forest-labs/flux-schnell";
        readonly name: "FLUX Schnell";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "$0.003/img";
    }, {
        readonly id: "stability-ai/sdxl";
        readonly name: "Stable Diffusion XL";
        readonly quality: "great";
        readonly speed: "medium";
        readonly cost: "$0.01/img";
    }, {
        readonly id: "stability-ai/stable-diffusion-3.5-large";
        readonly name: "SD 3.5 Large";
        readonly quality: "best";
        readonly speed: "slow";
        readonly cost: "$0.065/img";
    }, {
        readonly id: "bytedance/sdxl-lightning-4step";
        readonly name: "SDXL Lightning";
        readonly quality: "good";
        readonly speed: "fastest";
        readonly cost: "$0.002/img";
    }];
    readonly together: readonly [{
        readonly id: "black-forest-labs/FLUX.1-schnell-Free";
        readonly name: "FLUX Schnell (Free)";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "free";
    }, {
        readonly id: "black-forest-labs/FLUX.1-schnell";
        readonly name: "FLUX Schnell";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "$0.003/img";
    }, {
        readonly id: "black-forest-labs/FLUX.1.1-pro";
        readonly name: "FLUX 1.1 Pro";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "stabilityai/stable-diffusion-xl-base-1.0";
        readonly name: "SDXL Base";
        readonly quality: "great";
        readonly speed: "medium";
        readonly cost: "$0.006/img";
    }];
    readonly comfyui: readonly [{
        readonly id: "flux1-dev";
        readonly name: "FLUX.1 Dev (Local)";
        readonly quality: "great";
        readonly speed: "depends";
        readonly cost: "free (GPU)";
    }, {
        readonly id: "sdxl";
        readonly name: "SDXL (Local)";
        readonly quality: "great";
        readonly speed: "depends";
        readonly cost: "free (GPU)";
    }, {
        readonly id: "sd3.5";
        readonly name: "SD 3.5 (Local)";
        readonly quality: "best";
        readonly speed: "slow";
        readonly cost: "free (GPU)";
    }];
    readonly placeholder: readonly [{
        readonly id: "placeholder-svg";
        readonly name: "Placeholder SVG (Dev)";
        readonly quality: "mock";
        readonly speed: "instant";
        readonly cost: "free";
    }];
};
export declare class ImageGenService {
    private config;
    constructor(config: ImageGenConfig);
    get provider(): string;
    generate(req: ImageGenRequest): Promise<ImageGenResult>;
    /** List available models for current provider */
    listModels(): readonly [{
        readonly id: "imagen-4-ultra-generate-exp-05-20";
        readonly name: "Imagen 4 Ultra (exp)";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.06/img";
    }, {
        readonly id: "imagen-4-generate-exp-05-20";
        readonly name: "Imagen 4 (exp)";
        readonly quality: "great";
        readonly speed: "fast";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "imagen-3.0-generate-002";
        readonly name: "Imagen 3";
        readonly quality: "great";
        readonly speed: "fast";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "imagen-3.0-fast-generate-001";
        readonly name: "Imagen 3 Fast";
        readonly quality: "good";
        readonly speed: "fastest";
        readonly cost: "$0.02/img";
    }] | readonly [{
        readonly id: "black-forest-labs/flux-1.1-pro";
        readonly name: "FLUX 1.1 Pro";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "black-forest-labs/flux-schnell";
        readonly name: "FLUX Schnell";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "$0.003/img";
    }, {
        readonly id: "stability-ai/sdxl";
        readonly name: "Stable Diffusion XL";
        readonly quality: "great";
        readonly speed: "medium";
        readonly cost: "$0.01/img";
    }, {
        readonly id: "stability-ai/stable-diffusion-3.5-large";
        readonly name: "SD 3.5 Large";
        readonly quality: "best";
        readonly speed: "slow";
        readonly cost: "$0.065/img";
    }, {
        readonly id: "bytedance/sdxl-lightning-4step";
        readonly name: "SDXL Lightning";
        readonly quality: "good";
        readonly speed: "fastest";
        readonly cost: "$0.002/img";
    }] | readonly [{
        readonly id: "black-forest-labs/FLUX.1-schnell-Free";
        readonly name: "FLUX Schnell (Free)";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "free";
    }, {
        readonly id: "black-forest-labs/FLUX.1-schnell";
        readonly name: "FLUX Schnell";
        readonly quality: "good";
        readonly speed: "fast";
        readonly cost: "$0.003/img";
    }, {
        readonly id: "black-forest-labs/FLUX.1.1-pro";
        readonly name: "FLUX 1.1 Pro";
        readonly quality: "best";
        readonly speed: "medium";
        readonly cost: "$0.04/img";
    }, {
        readonly id: "stabilityai/stable-diffusion-xl-base-1.0";
        readonly name: "SDXL Base";
        readonly quality: "great";
        readonly speed: "medium";
        readonly cost: "$0.006/img";
    }] | readonly [{
        readonly id: "flux1-dev";
        readonly name: "FLUX.1 Dev (Local)";
        readonly quality: "great";
        readonly speed: "depends";
        readonly cost: "free (GPU)";
    }, {
        readonly id: "sdxl";
        readonly name: "SDXL (Local)";
        readonly quality: "great";
        readonly speed: "depends";
        readonly cost: "free (GPU)";
    }, {
        readonly id: "sd3.5";
        readonly name: "SD 3.5 (Local)";
        readonly quality: "best";
        readonly speed: "slow";
        readonly cost: "free (GPU)";
    }] | readonly [{
        readonly id: "placeholder-svg";
        readonly name: "Placeholder SVG (Dev)";
        readonly quality: "mock";
        readonly speed: "instant";
        readonly cost: "free";
    }];
    private generateGemini;
    private getAspectRatio;
    private generateReplicate;
    private generateTogether;
    private generateComfyUI;
    private buildComfyWorkflow;
    private pollComfyResult;
    private generatePlaceholder;
}
//# sourceMappingURL=image-gen.d.ts.map