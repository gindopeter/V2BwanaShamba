/**
 * LLM provider selection. Import { llm } from here anywhere in the server to
 * talk to the active AI provider through the provider-neutral interface.
 *
 * Switch providers with the LLM_PROVIDER env var (default: gemini). Adding a new
 * provider = implement LLMProvider in a new file and add a case below.
 */
import { GeminiProvider } from './gemini.ts';
import type { LLMProvider } from './types.ts';

function createProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  switch (provider) {
    case 'gemini':
    default:
      return new GeminiProvider();
  }
}

export const llm: LLMProvider = createProvider();
export { MODELS } from './models.ts';
export type { GenerateOptions, LLMProvider, ChatTurn } from './types.ts';
