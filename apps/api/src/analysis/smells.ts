import { randomUUID } from 'node:crypto';
import type { Graph, GraphNode, Smell } from '@projectgraf/shared';

export function detectSmells(graph: Graph): Smell[] {
  return [...detectCircularDependencies(graph), ...detectGodObjects(graph), ...detectHighFanout(graph)];
}

function detectCircularDependencies(graph: Graph): Smell[] {
  const adj = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!e.resolved) continue;
    if (!['imports', 'requires', 'includes', 'extends', 'instantiates'].includes(e.kind)) continue;
    let set = adj.get(e.sourceId);
    if (!set) {
      set = new Set();
      adj.set(e.sourceId, set);
    }
    set.add(e.targetId);
  }

  const sccs = tarjanSCC(adj);
  const smells: Smell[] = [];
  for (const comp of sccs) {
    if (comp.length < 2) continue;
    smells.push({
      id: randomUUID(),
      kind: 'circular_dependency',
      severity: comp.length > 3 ? 'error' : 'warning',
      nodeIds: comp,
      message: `Circular dependency between ${comp.length} nodes`,
      metric: comp.length,
    });
  }
  return smells;
}

function detectGodObjects(graph: Graph): Smell[] {
  const fanOut = new Map<string, number>();
  const fanIn = new Map<string, number>();
  for (const e of graph.edges) {
    fanOut.set(e.sourceId, (fanOut.get(e.sourceId) ?? 0) + 1);
    fanIn.set(e.targetId, (fanIn.get(e.targetId) ?? 0) + 1);
  }

  const smells: Smell[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'class' && node.kind !== 'file') continue;
    const methods = node.metadata.methodCount ?? 0;
    const loc = node.metadata.loc ?? 0;
    const out = fanOut.get(node.id) ?? 0;
    const inn = fanIn.get(node.id) ?? 0;
    const score = methods * 2 + Math.floor(loc / 80) + out + inn;
    if (methods >= 20 || loc >= 800 || score >= 50) {
      smells.push({
        id: randomUUID(),
        kind: 'god_object',
        severity: methods >= 40 ? 'error' : 'warning',
        nodeIds: [node.id],
        message: `${node.name}: ${methods} methods, ${loc} loc, fan-in ${inn}, fan-out ${out}`,
        metric: score,
      });
    }
  }
  return smells;
}

function detectHighFanout(graph: Graph): Smell[] {
  const fanOut = new Map<string, number>();
  for (const e of graph.edges) {
    fanOut.set(e.sourceId, (fanOut.get(e.sourceId) ?? 0) + 1);
  }
  const smells: Smell[] = [];
  for (const [nodeId, count] of fanOut) {
    if (count >= 25) {
      const node = graph.nodes.find((n: GraphNode) => n.id === nodeId);
      if (!node) continue;
      smells.push({
        id: randomUUID(),
        kind: 'high_fanout',
        severity: count >= 50 ? 'warning' : 'info',
        nodeIds: [nodeId],
        message: `${node.name} depends on ${count} other components`,
        metric: count,
      });
    }
  }
  return smells;
}

function tarjanSCC(adj: Map<string, Set<string>>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const sccs: string[][] = [];

  const allNodes = new Set<string>();
  for (const [k, v] of adj) {
    allNodes.add(k);
    for (const t of v) allNodes.add(t);
  }

  function strongconnect(v: string): void {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const succ = adj.get(v) ?? new Set<string>();
    for (const w of succ) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      sccs.push(comp);
    }
  }

  for (const v of allNodes) {
    if (!indices.has(v)) strongconnect(v);
  }
  return sccs;
}
