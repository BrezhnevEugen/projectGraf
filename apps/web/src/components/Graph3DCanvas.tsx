import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import type { Graph, GraphNode } from '@projectgraf/shared';
import { useAppStore } from '../store/store.js';

interface FGNode {
  id: string;
  name: string;
  kind: GraphNode['kind'];
  val: number;
  color: string;
}

interface FGLink {
  source: string;
  target: string;
  kind: string;
  color: string;
}

const KIND_COLOR: Record<GraphNode['kind'], string> = {
  file: '#475569',
  class: '#7c5cff',
  interface: '#22d3ee',
  trait: '#f59e0b',
  function: '#10b981',
  method: '#16a34a',
  property: '#94a3b8',
  module: '#3b82f6',
  html_page: '#ec4899',
  jquery_handler: '#f97316',
};

const EDGE_COLOR: Record<string, string> = {
  extends: '#7c5cff',
  implements: '#22d3ee',
  uses_trait: '#f59e0b',
  imports: '#475569',
  requires: '#475569',
  includes: '#475569',
  instantiates: '#10b981',
  script_src: '#ec4899',
  link_href: '#ec4899',
  anchor_href: '#ec4899',
  jquery_selects: '#f97316',
  references: '#94a3b8',
  calls: '#94a3b8',
};

function buildData(graph: Graph): { nodes: FGNode[]; links: FGLink[] } {
  const visibleKinds = new Set<GraphNode['kind']>([
    'file',
    'class',
    'interface',
    'trait',
    'html_page',
  ]);
  const visibleNodes = graph.nodes.filter((n) => visibleKinds.has(n.kind));
  const ids = new Set(visibleNodes.map((n) => n.id));

  const nodes: FGNode[] = visibleNodes.map((n) => ({
    id: n.id,
    name: `${n.kind}: ${n.name}`,
    kind: n.kind,
    val: Math.max(2, (n.metadata.methodCount ?? 1) * 1.2 + (n.metadata.loc ?? 0) / 80),
    color: KIND_COLOR[n.kind],
  }));

  const links: FGLink[] = graph.edges
    .filter((e) => e.resolved && ids.has(e.sourceId) && ids.has(e.targetId))
    .map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      kind: e.kind,
      color: EDGE_COLOR[e.kind] ?? '#2d343d',
    }));

  return { nodes, links };
}

export function Graph3DCanvas() {
  const graph = useAppStore((s) => s.graph);
  const selectNode = useAppStore((s) => s.selectNode);
  const selectedId = useAppStore((s) => s.selectedNodeId);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => (graph ? buildData(graph) : { nodes: [], links: [] }), [graph]);

  useEffect(() => {
    if (!selectedId || !fgRef.current) return;
    const node = data.nodes.find((n) => n.id === selectedId) as
      | (FGNode & { x?: number; y?: number; z?: number })
      | undefined;
    if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z || 1);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: (node.z || 1) * distRatio },
      { x: node.x, y: node.y, z: node.z },
      1000,
    );
  }, [selectedId, data]);

  if (!graph) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        Scan a project to see the graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor="#0e1116"
        nodeLabel="name"
        nodeColor={(n: FGNode) => (n.id === selectedId ? '#fef08a' : n.color)}
        nodeVal="val"
        nodeOpacity={0.95}
        nodeResolution={12}
        onNodeClick={(n: FGNode) => selectNode(n.id)}
        onBackgroundClick={() => selectNode(null)}
        linkColor={(l: FGLink) => l.color}
        linkOpacity={0.5}
        linkWidth={0.6}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(l: FGLink) => (l.kind === 'extends' || l.kind === 'implements' ? 2 : 0)}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={1.2}
        cooldownTicks={120}
        warmupTicks={20}
      />
    </div>
  );
}
