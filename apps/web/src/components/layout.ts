import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { Graph, GraphNode } from '@projectgraf/shared';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

const KIND_COLOR: Record<GraphNode['kind'], string> = {
  file: '#1f2731',
  class: '#7c5cff',
  interface: '#22d3ee',
  trait: '#f59e0b',
  function: '#10b981',
  method: '#16a34a',
  property: '#64748b',
  module: '#3b82f6',
  html_page: '#ec4899',
  jquery_handler: '#f97316',
};

export function graphToFlow(graph: Graph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  const visibleKinds = new Set<GraphNode['kind']>(['file', 'class', 'interface', 'trait', 'html_page']);
  const visibleNodes = graph.nodes.filter((n) => visibleKinds.has(n.kind));
  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  for (const n of visibleNodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of graph.edges) {
    if (!visibleIds.has(e.sourceId) || !visibleIds.has(e.targetId)) continue;
    g.setEdge(e.sourceId, e.targetId);
  }

  dagre.layout(g);

  const flowNodes: Node[] = visibleNodes.map((n) => {
    const layout = g.node(n.id);
    return {
      id: n.id,
      position: layout ? { x: layout.x - NODE_WIDTH / 2, y: layout.y - NODE_HEIGHT / 2 } : { x: 0, y: 0 },
      data: {
        label: shortName(n.name),
        kind: n.kind,
        loc: n.metadata.loc,
        methods: n.metadata.methodCount,
      },
      style: {
        background: KIND_COLOR[n.kind],
        color: '#fff',
        border: '1px solid #2d343d',
        width: NODE_WIDTH,
        padding: 8,
      },
    };
  });

  const flowEdges: Edge[] = graph.edges
    .filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId))
    .map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.kind,
      animated: e.kind === 'extends' || e.kind === 'implements',
      style: { stroke: edgeColor(e.kind) },
      labelStyle: { fill: '#8b949e', fontSize: 10 },
    }));

  return { nodes: flowNodes, edges: flowEdges };
}

function shortName(full: string): string {
  if (full.length <= 30) return full;
  const parts = full.split(/[\\/]/);
  return parts[parts.length - 1]!;
}

function edgeColor(kind: string): string {
  switch (kind) {
    case 'extends':
      return '#7c5cff';
    case 'implements':
      return '#22d3ee';
    case 'uses_trait':
      return '#f59e0b';
    case 'imports':
    case 'requires':
    case 'includes':
      return '#475569';
    case 'instantiates':
      return '#10b981';
    case 'script_src':
    case 'link_href':
    case 'anchor_href':
      return '#ec4899';
    default:
      return '#2d343d';
  }
}
