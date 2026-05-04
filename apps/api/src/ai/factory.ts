import type { LLMProvider, ProviderConfig } from '@projectgraf/shared';
import { buildOpenAICompatible } from './openai-compatible.js';
import { AnthropicProvider } from './anthropic.js';

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.name) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
    case 'deepseek':
    case 'openai':
    case 'openrouter':
      return buildOpenAICompatible(config);
  }
}
