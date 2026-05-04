import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import { useAppStore } from '../store/store.js';
import { graphToFlow } from './layout.js';

export function GraphCanvas() {
  const graph = useAppStore((s) => s.graph);
  const selectNode = useAppStore((s) => s.selectNode);
  const selectedId = useAppStore((s) => s.selectedNodeId);

  const initial = useMemo(() => (graph ? graphToFlow(graph) : { nodes: [], edges: [] }), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  if (!graph) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        Scan a project to see the graph.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={24} color="#1f2731" />
        <MiniMap
          pannable
          zoomable
          style={{ background: '#161b22' }}
          maskColor="rgba(14, 17, 22, 0.8)"
        />
        <Controls />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
