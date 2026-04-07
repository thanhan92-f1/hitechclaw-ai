/**
 * Image Generation Service — Multi-provider support
 *
 * Providers:
 *   - replicate   — Best quality (FLUX, SDXL, Stable Diffusion 3.5)
 *   - together    — Fast + cheap (FLUX Schnell, FLUX Pro)
 *   - comfyui     — Local Stable Diffusion (free, requires GPU)
 *   - placeholder — SVG/Canvas mock for dev mode (no GPU needed)
 */
// ─── Models Reference ───────────────────────────────────────
export const IMAGE_MODELS = {
    gemini: [
        { id: 'imagen-4-ultra-generate-exp-05-20', name: 'Imagen 4 Ultra (exp)', quality: 'best', speed: 'medium', cost: '$0.06/img' },
        { id: 'imagen-4-generate-exp-05-20', name: 'Imagen 4 (exp)', quality: 'great', speed: 'fast', cost: '$0.04/img' },
        { id: 'imagen-3.0-generate-002', name: 'Imagen 3', quality: 'great', speed: 'fast', cost: '$0.04/img' },
        { id: 'imagen-3.0-fast-generate-001', name: 'Imagen 3 Fast', quality: 'good', speed: 'fastest', cost: '$0.02/img' },
    ],
    replicate: [
        { id: 'black-forest-labs/flux-1.1-pro', name: 'FLUX 1.1 Pro', quality: 'best', speed: 'medium', cost: '$0.04/img' },
        { id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', quality: 'good', speed: 'fast', cost: '$0.003/img' },
        { id: 'stability-ai/sdxl', name: 'Stable Diffusion XL', quality: 'great', speed: 'medium', cost: '$0.01/img' },
        { id: 'stability-ai/stable-diffusion-3.5-large', name: 'SD 3.5 Large', quality: 'best', speed: 'slow', cost: '$0.065/img' },
        { id: 'bytedance/sdxl-lightning-4step', name: 'SDXL Lightning', quality: 'good', speed: 'fastest', cost: '$0.002/img' },
    ],
    together: [
        { id: 'black-forest-labs/FLUX.1-schnell-Free', name: 'FLUX Schnell (Free)', quality: 'good', speed: 'fast', cost: 'free' },
        { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX Schnell', quality: 'good', speed: 'fast', cost: '$0.003/img' },
        { id: 'black-forest-labs/FLUX.1.1-pro', name: 'FLUX 1.1 Pro', quality: 'best', speed: 'medium', cost: '$0.04/img' },
        { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base', quality: 'great', speed: 'medium', cost: '$0.006/img' },
    ],
    comfyui: [
        { id: 'flux1-dev', name: 'FLUX.1 Dev (Local)', quality: 'great', speed: 'depends', cost: 'free (GPU)' },
        { id: 'sdxl', name: 'SDXL (Local)', quality: 'great', speed: 'depends', cost: 'free (GPU)' },
        { id: 'sd3.5', name: 'SD 3.5 (Local)', quality: 'best', speed: 'slow', cost: 'free (GPU)' },
    ],
    placeholder: [
        { id: 'placeholder-svg', name: 'Placeholder SVG (Dev)', quality: 'mock', speed: 'instant', cost: 'free' },
    ],
};
// ─── Image Generation Service ───────────────────────────────
export class ImageGenService {
    config;
    constructor(config) {
        this.config = config;
    }
    get provider() {
        return this.config.provider;
    }
    async generate(req) {
        const start = Date.now();
        const count = req.count || 1;
        switch (this.config.provider) {
            case 'gemini':
                return this.generateGemini(req, count, start);
            case 'replicate':
                return this.generateReplicate(req, count, start);
            case 'together':
                return this.generateTogether(req, count, start);
            case 'comfyui':
                return this.generateComfyUI(req, count, start);
            case 'placeholder':
            default:
                return this.generatePlaceholder(req, count, start);
        }
    }
    /** List available models for current provider */
    listModels() {
        return IMAGE_MODELS[this.config.provider] || [];
    }
    // ─── Gemini (Google Imagen) ──────────────────────────────
    async generateGemini(req, count, start) {
        const apiKey = this.config.apiKey;
        if (!apiKey)
            throw new Error('GEMINI_API_KEY is required');
        const model = req.model || this.config.defaultModel || 'imagen-3.0-generate-002';
        const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        const images = [];
        // Gemini Imagen API: POST /models/{model}:predict
        const body = {
            instances: [{ prompt: req.prompt }],
            parameters: {
                sampleCount: Math.min(count, 4), // Imagen supports up to 4 per request
                aspectRatio: this.getAspectRatio(req.width || 1024, req.height || 1024),
                ...(req.negativePrompt && { negativePrompt: req.negativePrompt }),
                ...(req.seed !== undefined && { seed: req.seed }),
            },
        };
        const res = await fetch(`${baseUrl}/models/${model}:predict?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini Imagen API error: ${res.status} ${errText}`);
        }
        const data = await res.json();
        if (!data.predictions?.length)
            throw new Error('Gemini Imagen: no images returned');
        for (let i = 0; i < data.predictions.length && i < count; i++) {
            const pred = data.predictions[i];
            const mime = pred.mimeType || 'image/png';
            images.push({
                url: `data:${mime};base64,${pred.bytesBase64Encoded}`,
                width: req.width || 1024,
                height: req.height || 1024,
                seed: req.seed !== undefined ? req.seed + i : undefined,
            });
        }
        return { images, model, provider: 'gemini', durationMs: Date.now() - start };
    }
    getAspectRatio(w, h) {
        const ratio = w / h;
        if (ratio > 1.7)
            return '16:9';
        if (ratio > 1.3)
            return '3:2';
        if (ratio > 1.1)
            return '4:3';
        if (ratio < 0.6)
            return '9:16';
        if (ratio < 0.75)
            return '2:3';
        if (ratio < 0.9)
            return '3:4';
        return '1:1';
    }
    // ─── Replicate ──────────────────────────────────────────
    async generateReplicate(req, count, start) {
        const apiKey = this.config.apiKey;
        if (!apiKey)
            throw new Error('REPLICATE_API_KEY is required');
        const model = req.model || this.config.defaultModel || 'black-forest-labs/flux-schnell';
        const images = [];
        for (let i = 0; i < count; i++) {
            const body = {
                input: {
                    prompt: req.prompt,
                    width: req.width || 1024,
                    height: req.height || 1024,
                    num_inference_steps: req.steps || 4,
                    guidance_scale: req.guidanceScale || 7.5,
                    ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
                    ...(req.seed !== undefined && { seed: req.seed + i }),
                },
            };
            // Create prediction
            const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'wait',
                },
                body: JSON.stringify(body),
            });
            if (!createRes.ok) {
                const errText = await createRes.text();
                throw new Error(`Replicate API error: ${createRes.status} ${errText}`);
            }
            const prediction = await createRes.json();
            if (prediction.error)
                throw new Error(`Replicate: ${prediction.error}`);
            const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
            if (!outputUrl)
                throw new Error('Replicate: no output returned');
            images.push({
                url: outputUrl,
                width: req.width || 1024,
                height: req.height || 1024,
                seed: req.seed !== undefined ? req.seed + i : undefined,
            });
        }
        return { images, model, provider: 'replicate', durationMs: Date.now() - start };
    }
    // ─── Together.ai ────────────────────────────────────────
    async generateTogether(req, count, start) {
        const apiKey = this.config.apiKey;
        if (!apiKey)
            throw new Error('TOGETHER_API_KEY is required');
        const model = req.model || this.config.defaultModel || 'black-forest-labs/FLUX.1-schnell-Free';
        const baseUrl = this.config.baseUrl || 'https://api.together.xyz/v1';
        const body = {
            model,
            prompt: req.prompt,
            width: req.width || 1024,
            height: req.height || 1024,
            steps: req.steps || 4,
            n: count,
            response_format: 'b64_json',
            ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
            ...(req.seed !== undefined && { seed: req.seed }),
        };
        const res = await fetch(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Together API error: ${res.status} ${errText}`);
        }
        const data = await res.json();
        const images = data.data.map((item, i) => ({
            url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : (item.url || ''),
            width: req.width || 1024,
            height: req.height || 1024,
            seed: req.seed !== undefined ? req.seed + i : undefined,
        }));
        return { images, model, provider: 'together', durationMs: Date.now() - start };
    }
    // ─── ComfyUI (Local) ───────────────────────────────────
    async generateComfyUI(req, count, start) {
        const baseUrl = this.config.baseUrl || 'http://localhost:8188';
        const model = req.model || this.config.defaultModel || 'flux1-dev';
        const images = [];
        for (let i = 0; i < count; i++) {
            const workflow = this.buildComfyWorkflow(req, model, i);
            // Queue prompt
            const queueRes = await fetch(`${baseUrl}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: workflow }),
            });
            if (!queueRes.ok)
                throw new Error(`ComfyUI queue error: ${queueRes.status}`);
            const { prompt_id } = await queueRes.json();
            // Poll for completion
            const imageUrl = await this.pollComfyResult(baseUrl, prompt_id);
            images.push({
                url: imageUrl,
                width: req.width || 1024,
                height: req.height || 1024,
                seed: req.seed !== undefined ? req.seed + i : undefined,
            });
        }
        return { images, model, provider: 'comfyui', durationMs: Date.now() - start };
    }
    buildComfyWorkflow(req, _model, index) {
        const seed = req.seed !== undefined ? req.seed + index : Math.floor(Math.random() * 2147483647);
        return {
            '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'flux1-dev.safetensors' } },
            '2': { class_type: 'CLIPTextEncode', inputs: { text: req.prompt, clip: ['1', 1] } },
            '3': { class_type: 'CLIPTextEncode', inputs: { text: req.negativePrompt || '', clip: ['1', 1] } },
            '4': { class_type: 'EmptyLatentImage', inputs: { width: req.width || 1024, height: req.height || 1024, batch_size: 1 } },
            '5': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps: req.steps || 20, cfg: req.guidanceScale || 7.5, sampler_name: 'euler', scheduler: 'normal' } },
            '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
            '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'hitechclaw' } },
        };
    }
    async pollComfyResult(baseUrl, promptId, maxWait = 120000) {
        const deadline = Date.now() + maxWait;
        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1000));
            const historyRes = await fetch(`${baseUrl}/history/${promptId}`);
            if (!historyRes.ok)
                continue;
            const history = await historyRes.json();
            const entry = history[promptId];
            if (!entry?.outputs)
                continue;
            for (const nodeOutput of Object.values(entry.outputs)) {
                if (nodeOutput.images?.length) {
                    const img = nodeOutput.images[0];
                    // Fetch image as base64
                    const imgRes = await fetch(`${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}`);
                    if (!imgRes.ok)
                        continue;
                    const buffer = await imgRes.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    return `data:image/png;base64,${base64}`;
                }
            }
        }
        throw new Error('ComfyUI: generation timed out');
    }
    // ─── Placeholder (Dev Mode) ─────────────────────────────
    async generatePlaceholder(req, count, start) {
        const w = req.width || 1024;
        const h = req.height || 1024;
        const images = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        const tags = req.prompt.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
        for (let i = 0; i < count; i++) {
            const bg = colors[(i + (req.seed || 0)) % colors.length];
            const fg = colors[((i + 3) + (req.seed || 0)) % colors.length];
            const seed = req.seed !== undefined ? req.seed + i : Math.floor(Math.random() * 999999);
            // Generate a colorful SVG placeholder with design info
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg${i}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${fg};stop-opacity:1" />
    </linearGradient>
    <pattern id="grid${i}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg${i})"/>
  <rect width="${w}" height="${h}" fill="url(#grid${i})"/>
  <circle cx="${w * 0.5}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.2}" fill="rgba(255,255,255,0.15)" />
  <text x="${w / 2}" y="${h * 0.35}" text-anchor="middle" fill="white" font-size="${Math.min(w, h) * 0.06}" font-family="Arial, sans-serif" font-weight="bold">🎨 TeeForge.AI</text>
  <text x="${w / 2}" y="${h * 0.45}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="${Math.min(w, h) * 0.03}" font-family="Arial, sans-serif">${tags || 'generated design'}</text>
  <text x="${w / 2}" y="${h * 0.55}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="${Math.min(w, h) * 0.025}" font-family="Arial, sans-serif">Variation ${i + 1} • Seed: ${seed}</text>
  <text x="${w / 2}" y="${h * 0.9}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="${Math.min(w, h) * 0.02}" font-family="Arial, sans-serif">${w}×${h} • placeholder mode</text>
</svg>`;
            const base64 = Buffer.from(svg).toString('base64');
            images.push({
                url: `data:image/svg+xml;base64,${base64}`,
                width: w,
                height: h,
                seed,
            });
        }
        // Simulate generation delay
        await new Promise((r) => setTimeout(r, 200));
        return { images, model: 'placeholder', provider: 'placeholder', durationMs: Date.now() - start };
    }
}
//# sourceMappingURL=image-gen.js.map