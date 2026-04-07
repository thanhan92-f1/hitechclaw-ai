/**
 * Image Generation Tool — Generate images using DALL-E 3 or Stability AI.
 * Uses OpenAI's image generation API with fallback support.
 */
export const imageGenDefinition = {
    name: 'generate_image',
    description: 'Generate an image from a text description using AI (DALL-E 3). Returns an image URL.',
    category: 'content',
    parameters: [
        {
            name: 'prompt',
            type: 'string',
            description: 'Detailed description of the image to generate',
            required: true,
        },
        {
            name: 'size',
            type: 'string',
            description: 'Image size: 1024x1024, 1024x1792, or 1792x1024',
            required: false,
            enum: ['1024x1024', '1024x1792', '1792x1024'],
        },
        {
            name: 'quality',
            type: 'string',
            description: 'Image quality: standard or hd',
            required: false,
            enum: ['standard', 'hd'],
        },
        {
            name: 'style',
            type: 'string',
            description: 'Image style: vivid or natural',
            required: false,
            enum: ['vivid', 'natural'],
        },
    ],
};
export function createImageGenHandler(apiKey) {
    return async (args) => {
        var _a;
        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key)
            throw new Error('OPENAI_API_KEY is required for image generation');
        const prompt = args.prompt;
        if (!prompt)
            throw new Error('prompt is required');
        const size = args.size || '1024x1024';
        const quality = args.quality || 'standard';
        const style = args.style || 'vivid';
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt,
                n: 1,
                size,
                quality,
                style,
                response_format: 'url',
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Image generation failed: ${((_a = err.error) === null || _a === void 0 ? void 0 : _a.message) || res.statusText}`);
        }
        const data = await res.json();
        const image = data.data[0];
        return {
            url: image.url,
            revised_prompt: image.revised_prompt,
            size,
            quality,
            style,
            model: 'dall-e-3',
        };
    };
}
