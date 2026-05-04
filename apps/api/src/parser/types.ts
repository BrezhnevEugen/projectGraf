import type { GraphEdge, GraphNode } from '@projectgraf/shared';

export interface ParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ParseInput {
  absPath: string;
  relPath: string;
  source: string;
  fileNodeId: string;
}
