import type {
  ArchitectureReview,
  Graph,
  GraphNode,
  LLMProvider,
  NodeDescription,
  ProviderConfig,
} from '@projectgraf/shared';
import {
  ARCHITECTURE_REVIEW_SYSTEM,
  NODE_DESCRIBE_SYSTEM,
  architectureReviewPrompt,
  nodeDescribePrompt,
  safeParseJson,
} from './prompts.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('Anthropic API key required');
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-6';
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
  }

  async describeNode(node: GraphNode, sourceExcerpt: string): Promise<NodeDescription> {
    const content = await this.message(NODE_DESCRIBE_SYSTEM, nodeDescribePrompt(node, sourceExcerpt));
    const parsed = safeParseJson<{ summary?: string; role?: string; concerns?: string[] }>(content) ?? {};
    return {
      nodeId: node.id,
      summary: parsed.summary ?? content.slice(0, 400),
      role: parsed.role,
      concerns: parsed.concerns,
      generatedAt: new Date().toISOString(),
      provider: this.name,
      model: this.model,
    };
  }

  async reviewArchitecture(graph: Graph): Promise<ArchitectureReview> {
    const content = await this.message(ARCHITECTURE_REVIEW_SYSTEM, architectureReviewPrompt(graph));
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
      model: this.model,
    };
  }

  private async message(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`anthropic ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return json.content?.find((c) => c.type === 'text')?.text ?? '';
  }
}
