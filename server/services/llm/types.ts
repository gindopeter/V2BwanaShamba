/**
 * Provider-neutral LLM interface ("the socket").
 *
 * The rest of the app talks to this interface instead of importing a specific
 * AI SDK directly. To switch providers (e.g. Gemini -> Claude or a self-hosted
 * model) you add one new adapter that implements LLMProvider and point
 * index.ts at it — no changes needed in the routes/services that consume it.
 */

/** A single chat turn in the provider-neutral format (mirrors Gemini's shape). */
export interface ChatTurn {
  role: string;
  parts: any[];
}

export interface GenerateOptions {
  /** Conversation turns (user/model). Image parts may be embedded in a turn. */
  contents: ChatTurn[] | any[];
  /** System prompt / instruction for this request. */
  systemInstruction?: string;
  /** Optional model override. Defaults to the chat model in models.ts. */
  model?: string;
  /** Advanced provider config passthrough (e.g. TTS audio modalities). */
  config?: Record<string, any>;
}

export interface LLMProvider {
  /** One-shot text generation. Returns the reply text (may be empty). */
  generate(opts: GenerateOptions): Promise<string>;

  /** Streaming text generation. Calls onChunk for each piece; resolves with the full text. */
  generateStream(opts: GenerateOptions, onChunk: (piece: string) => void): Promise<string>;

  /**
   * Returns the raw provider response object. Used for non-text outputs that
   * need provider-specific fields (e.g. TTS audio bytes). Kept narrow on purpose.
   */
  generateRaw(opts: GenerateOptions): Promise<any>;
}
