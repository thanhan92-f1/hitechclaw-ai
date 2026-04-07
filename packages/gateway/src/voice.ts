// ============================================================
// Voice Routes — STT (Whisper via Ollama) + TTS
// ============================================================

import { Hono } from 'hono';
import type { GatewayContext } from './gateway.js';

export function createVoiceRoutes(ctx: GatewayContext) {
  const app = new Hono();

  // ─── Transcribe Audio → Text (via Ollama Whisper or OpenAI) ─

  app.post('/transcribe', async (c) => {
    try {
      const body = await c.req.parseBody();
      const audio = body['audio'];

      if (!audio || !(audio instanceof File)) {
        return c.json({ error: 'audio file is required' }, 400);
      }

      // Cap at 25 MB to prevent abuse
      if (audio.size > 25 * 1024 * 1024) {
        return c.json({ error: 'Audio file too large (max 25MB)' }, 400);
      }

      const language = typeof body['language'] === 'string' ? body['language'] : undefined;

      // Try OpenAI Whisper API first (if OPENAI_API_KEY is set)
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const result = await transcribeWithOpenAI(audio, openaiKey, language);
        return c.json(result);
      }

      // Fallback: try Ollama whisper endpoint
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const result = await transcribeWithOllama(audio, ollamaUrl, language);
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Transcription failed' }, 500);
    }
  });

  // ─── TTS — Generate speech from text ──────────────────────

  app.post('/tts', async (c) => {
    try {
      const { text, voice, speed } = await c.req.json<{ text: string; voice?: string; speed?: number }>();

      if (!text || text.length > 4096) {
        return c.json({ error: 'text is required (max 4096 chars)' }, 400);
      }

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return c.json({ error: 'TTS requires OPENAI_API_KEY' }, 501);
      }

      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice || 'alloy',
          speed: speed || 1.0,
          response_format: 'mp3',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI TTS failed: ${res.status} ${body}`);
      }

      const audioBuffer = await res.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'TTS failed' }, 500);
    }
  });

  // ─── List available TTS voices ────────────────────────────

  app.get('/voices', (c) => {
    return c.json({
      ok: true,
      voices: [
        { id: 'alloy', name: 'Alloy', gender: 'neutral' },
        { id: 'echo', name: 'Echo', gender: 'male' },
        { id: 'fable', name: 'Fable', gender: 'neutral' },
        { id: 'onyx', name: 'Onyx', gender: 'male' },
        { id: 'nova', name: 'Nova', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', gender: 'female' },
      ],
    });
  });

  return app;
}

// ─── OpenAI Whisper Transcription ───────────────────────────

async function transcribeWithOpenAI(
  audio: File,
  apiKey: string,
  language?: string,
): Promise<{ text: string; language?: string; duration?: number }> {
  const formData = new FormData();
  formData.append('file', audio);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  if (language) formData.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Whisper failed: ${res.status} ${body}`);
  }

  const data = await res.json() as {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  };

  return {
    text: data.text,
    language: data.language,
    duration: data.duration,
  };
}

// ─── Ollama Whisper Transcription ───────────────────────────

async function transcribeWithOllama(
  audio: File,
  ollamaUrl: string,
  language?: string,
): Promise<{ text: string; language?: string }> {
  // Convert audio to base64 for Ollama
  const buffer = await audio.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'whisper',
      prompt: language
        ? `Transcribe this audio to text. The language is ${language}.`
        : 'Transcribe this audio to text.',
      images: [base64], // Ollama uses images field for binary data
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error('Ollama whisper transcription failed — ensure "whisper" model is pulled');
  }

  const data = await res.json() as { response: string };
  return { text: data.response, language };
}
