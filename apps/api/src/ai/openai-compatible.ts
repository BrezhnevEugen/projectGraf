import type {
  ArchitectureReview,
  Graph,
  GraphNode,
  LLMProvider,
  NodeDescription,
  ProviderConfig,
  ProviderName,
} from '@projectgraf/shared';
import {
  ARCHITECTURE_REVIEW_SYSTEM,
  NODE_DESCRIBE_SYSTEM,
  architectureReviewPrompt,
  nodeDescribePrompt,
  safeParseJson,
} from './prompts.js';

export interface OpenAICompatibleOptions {
  name: ProviderName;
  model: string;
  baseUrl: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: ProviderName;

  constructor(private readonly opts: OpenAICompatibleOptions) {
    this.name = opts.name;
  }

  async describeNode(node: GraphNode, sourceExcerpt: string): Promise<NodeDescription> {
    const content = await this.chat([
      { role: 'system', content: NODE_DESCRIBE_SYSTEM },
      { role: 'user', content: nodeDescribePrompt(node, sourceExcerpt) },
    ]);
    const parsed = safeParseJson<{ summary?: string; role?: string; concerns?: string[] }>(content) ?? {};
    return {
      nodeId: node.id,
      summary: parsed.summary ?? content.slice(0, 400),
      role: parsed.role,
      concerns: parsed.concerns,
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.opts.model,
    };
  }

  async reviewArchitecture(graph: Graph): Promise<ArchitectureReview> {
    const content = await this.chat([
      { role: 'system', content: ARCHITECTURE_REVIEW_SYSTEM },
      { role: 'user', content: architectureReviewPrompt(graph) },
    ]);
    const parsed = safeParseJson<{
      highlights?: string[];
      risks?: string[];
      recommendations?: string[];
    }>(content) ?? {};
    return {
      highlights: parsed.highlights ?? [],
      risks: parsed.risks ?? [],
      recommendations: parsed.recommendations ?? [],
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.opts.model,
    };
  }

  private async chat(messages: { role: string; content: string }[]): Promise<string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.opts.extraHeaders ?? {}),
    };
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`;

    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.opts.model,
        messages,
        temperature: 0.2,
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${this.name} ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? '';
  }
}

const DEFAULTS: Record<ProviderName, { baseUrl: string; defaultModel: string }> = {
  ollama: { baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-6' },
};

export function defaultsFor(name: ProviderName): { baseUrl: string; defaultModel: string } {
  return DEFAULTS[name];
}

export function buildOpenAICompatible(config: ProviderConfig): OpenAICompatibleProvider {
  const def = DEFAULTS[config.name];
  return new OpenAICompatibleProvider({
    name: config.name,
    model: config.model || def.defaultModel,
    baseUrl: config.baseUrl ?? def.baseUrl,
    apiKey: config.apiKey,
    extraHeaders:
      config.name === 'openrouter'
        ? { 'HTTP-Referer': 'https://github.com/BrezhnevEugen/projectGraf', 'X-Title': 'ProjectGraf' }
        : undefined,
  });
}
