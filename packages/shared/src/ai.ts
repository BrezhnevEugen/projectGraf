import type { Graph, GraphNode } from './graph.js';

export type ProviderName = 'ollama' | 'deepseek' | 'openai' | 'anthropic' | 'openrouter';

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface NodeDescription {
  nodeId: string;
  summary: string;
  role?: string;
  concerns?: string[];
  generatedAt: string;
  provider: ProviderName;
  model: string;
}

export interface ArchitectureReview {
  highlights: string[];
  risks: string[];
  recommendations: string[];
  generatedAt: string;
  provider: ProviderName;
  model: string;
}

export interface LLMProvider {
  readonly name: ProviderName;
  describeNode(node: GraphNode, sourceExcerpt: string): Promise<NodeDescription>;
  reviewArchitecture(graph: Graph): Promise<ArchitectureReview>;
}
