
import React, { useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';

interface GraphData {
  nodes: { id: string; scope: string; is_protocol: boolean }[];
  edges: { from: string; to: string }[];
}

interface GraphVisualizerProps {
  data: GraphData | null;
}

// Custom Node for Protocols
const ProtocolNode = ({ data }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      <div className="bg-sky-900/70 border-2 border-dashed border-sky-500 rounded-lg w-48 shadow-lg text-center p-3">
        <div className="text-sky-300 font-bold">{data.label}</div>
        <div className="text-xs text-sky-500 mt-1">(Protocol)</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </>
  );
};

// Custom Node for Concrete Components
const ComponentNode = ({ data }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      <div className="bg-slate-700 border-2 border-slate-500 rounded-lg w-48 shadow-lg">
        <div className="bg-slate-800 px-3 py-1.5 rounded-t-lg">
            <div className="text-slate-100 font-bold">{data.label}</div>
        </div>
        <div className="px-3 py-2 text-sm">
            <span className="text-slate-400">scope: </span>
            <span className="text-cyan-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{data.scope}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </>
  );
};

const nodeTypes = {
  protocol: ProtocolNode,
  component: ComponentNode,
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data || !data.nodes || !data.edges) return;

    // Implements Kahn's algorithm for topological sorting to create a layered graph layout.
    // This arranges nodes in columns based on their dependencies.

    const { nodes: dataNodes, edges: dataEdges } = data;

    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    dataNodes.forEach(node => {
        inDegree.set(node.id, 0);
        adj.set(node.id, []);
    });
    
    // An edge from A to B means A depends on B.
    // For layout, we want dependencies (sources) on the left.
    // So we treat 'to' as the source and 'from' as the target.
    dataEdges.forEach(edge => {
        adj.get(edge.to)!.push(edge.from);
        inDegree.set(edge.from, inDegree.get(edge.from)! + 1);
    });

    let nodesInCurrentLayer: string[] = [];
    dataNodes.forEach(node => {
        if (inDegree.get(node.id) === 0) {
            nodesInCurrentLayer.push(node.id);
        }
    });

    const positionedNodes = [];
    const xOffset = 350;
    const yOffset = 150;
    let layerIndex = 0;
    
    while (nodesInCurrentLayer.length > 0) {
        const nodesInNextLayer: string[] = [];
        const layerHeight = nodesInCurrentLayer.length * yOffset;

        nodesInCurrentLayer.forEach((nodeId, i) => {
            const originalNode = dataNodes.find(n => n.id === nodeId);
            if (originalNode) {
                positionedNodes.push({
                    id: originalNode.id,
                    type: originalNode.is_protocol ? 'protocol' : 'component',
                    position: {
                        x: layerIndex * xOffset,
                        y: (i * yOffset) - (layerHeight / 2) + (yOffset / 2),
                    },
                    data: { 
                        label: originalNode.id, 
                        scope: originalNode.scope 
                    },
                });
            }

            const neighbors = adj.get(nodeId) || [];
            for (const neighborId of neighbors) {
                const newDegree = (inDegree.get(neighborId) || 1) - 1;
                inDegree.set(neighborId, newDegree);
                if (newDegree === 0) {
                    nodesInNextLayer.push(neighborId);
                }
            }
        });
        
        nodesInCurrentLayer = nodesInNextLayer;
        layerIndex++;
    }

    // Fallback for any nodes not positioned (e.g., cycles)
    dataNodes.forEach(node => {
        if (!positionedNodes.some(p => p.id === node.id)) {
            positionedNodes.push({
                 id: node.id,
                 type: node.is_protocol ? 'protocol' : 'component',
                 position: { x: layerIndex * xOffset, y: positionedNodes.length * yOffset },
                 data: { label: node.id, scope: node.scope },
            });
        }
    });

    const initialEdges = data.edges.map((edge, index) => ({
      id: `e-${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      animated: true,
      style: { stroke: '#64748b', strokeWidth: 1.5 },
      // FIX: Use MarkerType enum for type safety instead of a string literal.
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    }));

    setNodes(positionedNodes);
    setEdges(initialEdges);
  }, [data, setNodes, setEdges]);

  if (!data) {
    return (
      <div className="h-full w-full p-4 overflow-auto flex items-center justify-center">
        <p className="text-slate-500">No graph data to display.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full" key={JSON.stringify(data)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background gap={16} size={1} color="#1f2937" />
      </ReactFlow>
    </div>
  );
};

export default GraphVisualizer;