/**
 * Single source of truth for model names.
 *
 * Previously model IDs were hardcoded in ~8 places across the codebase. Now they
 * live here, overridable via environment variables so that swapping or upgrading
 * a model is a one-line/config change rather than a code hunt. Several of these
 * defaults are *preview* models that the provider may rename or retire — keeping
 * them here means a single edit when that happens.
 */
export const MODELS = {
  /** Main farmer-facing chat + image analysis. */
  chat: process.env.LLM_CHAT_MODEL || 'gemini-3-flash-preview',
  /** Cheap/fast model for background tasks like memory extraction. */
  fast: process.env.LLM_FAST_MODEL || 'gemini-3-flash-preview',
  /** Crop planning + recommendations (JSON generation). */
  planning: process.env.LLM_PLANNING_MODEL || 'gemini-3-flash-preview',
  /** Text-to-speech. */
  tts: process.env.LLM_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
};
