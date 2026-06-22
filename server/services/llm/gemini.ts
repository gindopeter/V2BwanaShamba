/**
 * Gemini adapter — the ONLY file that imports the Google GenAI SDK for normal
 * text/chat work. Everything else talks to the LLMProvider interface.
 */
import { GoogleGenAI } from '@google/genai';
import type { GenerateOptions, LLMProvider } from './types.ts';
import { MODELS } from './models.ts';

export class GeminiProvider implements LLMProvider {
  private _client: GoogleGenAI | null = null;

  /** Lazily create the SDK client so a missing key fails at call time, not import time. */
  private client(): GoogleGenAI {
    if (!this._client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
      this._client = new GoogleGenAI({ apiKey });
    }
    return this._client;
  }

  private buildRequest(opts: GenerateOptions): any {
    const config: Record<string, any> = { ...(opts.config || {}) };
    if (opts.systemInstruction) config.systemInstruction = opts.systemInstruction;
    const req: any = {
      model: opts.model || MODELS.chat,
      contents: opts.contents,
    };
    if (Object.keys(config).length > 0) req.config = config;
    return req;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const res = await this.client().models.generateContent(this.buildRequest(opts));
    return res.text || '';
  }

  async generateStream(opts: GenerateOptions, onChunk: (piece: string) => void): Promise<string> {
    const stream = await this.client().models.generateContentStream(this.buildRequest(opts));
    let full = '';
    for await (const chunk of stream) {
      const piece = chunk.text;
      if (piece) {
        full += piece;
        onChunk(piece);
      }
    }
    return full;
  }

  async generateRaw(opts: GenerateOptions): Promise<any> {
    return this.client().models.generateContent(this.buildRequest(opts));
  }
}
