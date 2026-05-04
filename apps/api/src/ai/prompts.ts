import type { Graph, GraphNode } from '@projectgraf/shared';

export const NODE_DESCRIBE_SYSTEM = `You are a senior software architect. Given a code excerpt and metadata about a code element (class, function, file, etc.) from a real-world project, produce a concise description of its role.

Reply ONLY with a JSON object matching this schema:
{
  "summary": "1-3 sentence description of what this element does and why it exists",
  "role": "short role label, e.g. 'controller', 'data mapper', 'utility', 'view template'",
  "concerns": ["optional list of concerns or smells you notice"]
}

Do not include markdown fences. Do not include any prose outside the JSON.`;

export const ARCHITECTURE_REVIEW_SYSTEM = `You are a senior software architect performing a high-level review of a codebase based on its component graph (nodes are classes/files/functions, edges are imports, inheritance, instantiation, etc.).

Reply ONLY with a JSON object matching this schema:
{
  "highlights": ["positive observations about the architecture"],
  "risks": ["architectural risks: god objects, tangles, missing layering, etc."],
  "recommendations": ["concrete next steps"]
}

Do not include markdown fences. Do not include any prose outside the JSON.`;

export function nodeDescribePrompt(node: GraphNode, sourceExcerpt: string): string {
  const meta = JSON.stringify(
    {
      kind: node.kind,
      name: node.name,
      language: node.language,
      file: node.location.file,
      lines: `${node.location.startLine}-${node.location.endLine}`,
      ...node.metadata,
    },
    null,
    2,
  );
  return `Element metadata:\n${meta}\n\nSource excerpt:\n\`\`\`${node.language}\n${sourceExcerpt}\n\`\`\``;
}

export function architectureReviewPrompt(graph: Graph): string {
  const sample = graph.nodes.slice(0, 200).map((n) => ({
    id: n.id.slice(0, 8),
    kind: n.kind,
    name: n.name,
    methods: n.metadata.methodCount,
    loc: n.metadata.loc,
  }));
  const edgeCounts: Record<string, number> = {};
  for (const e of graph.edges) {
    edgeCounts[e.kind] = (edgeCounts[e.kind] ?? 0) + 1;
  }
  return `Project: ${graph.rootPath}
Stats: ${JSON.stringify(graph.stats)}
Edge kinds: ${JSON.stringify(edgeCounts)}
Sample nodes (first 200):
${JSON.stringify(sample, null, 2)}`;
}

export function safeParseJson<T>(raw: string): T | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\n?/i, '').replace(/```$/i, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    const first = match?.[0];
    if (!first) return null;
    try {
      return JSON.parse(first) as T;
    } catch {
      return null;
    }
  }
}
