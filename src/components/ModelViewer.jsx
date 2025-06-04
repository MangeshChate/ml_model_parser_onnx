import React, { useMemo, useEffect } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

const ModelViewer = ({ modelData }) => {
  const operatorFrequency = modelData?.analysis?.operatorFrequency || {};

  // Build nodes and edges from modelData.graph.nodes or fallback to sample data
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!modelData?.graph?.nodes || !Array.isArray(modelData.graph.nodes)) {
      // Sample data fallback
      const sampleNodes = [
        {
          id: "1",
          type: "input",
          position: { x: 100, y: 100 },
          data: { label: "Input" },
        },
        {
          id: "2",
          type: "default",
          position: { x: 300, y: 100 },
          data: { label: "Process" },
        },
        {
          id: "3",
          type: "output",
          position: { x: 500, y: 100 },
          data: { label: "Output" },
        },
      ];

      const sampleEdges = [
        { id: "e1-2", source: "1", target: "2", animated: true },
        { id: "e2-3", source: "2", target: "3", animated: true },
      ];

      return { nodes: sampleNodes, edges: sampleEdges };
    }

    const nodes = [];
    const edges = [];
    const nameToId = new Map();
    const processedInputs = new Set();
    let uid = 1;

    const getId = (name) => {
      if (!nameToId.has(name)) {
        nameToId.set(name, `id-${uid++}`);
      }
      return nameToId.get(name);
    };

    // Create input nodes first
    modelData.graph.nodes.forEach((node) => {
      if (node.input && Array.isArray(node.input)) {
        node.input.forEach((input) => {
          if (!processedInputs.has(input)) {
            const inputId = getId(input);
            nodes.push({
              id: inputId,
              type: "input",
              position: { x: 50, y: 50 + processedInputs.size * 100 },
              data: {
                label: input.length > 20 ? input.substring(0, 20) + "..." : input,
              },
            });
            processedInputs.add(input);
          }
        });
      }
    });

    // Create operation nodes and edges
    modelData.graph.nodes.forEach((node, index) => {
      const outputName = node.output?.[0] || node.name || `node-${index}`;
      const nodeId = getId(outputName);

      nodes.push({
        id: nodeId,
        type: "default",
        position: {
          x: 300 + (index % 4) * 200,
          y: 100 + Math.floor(index / 4) * 150,
        },
        data: {
          label: node.opType || node.op_type || node.type || `Node ${index}`,
        },
      });

      if (node.input && Array.isArray(node.input)) {
        node.input.forEach((input) => {
          const inputId = getId(input);
          edges.push({
            id: `e-${inputId}-${nodeId}`,
            source: inputId,
            target: nodeId,
            animated: true,
          });
        });
      }
    });

    return { nodes, edges };
  }, [modelData]);

  // Initialize React Flow state with empty arrays first
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync React Flow state whenever initialNodes/initialEdges change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!modelData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">Upload an ONNX model to view its structure</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-4 overflow-auto max-h-96">
        <h3 className="text-lg font-medium text-white mb-2">Complete Model Structure</h3>
        <JSONPretty
          id="json-pretty"
          data={modelData}
          className="text-sm"
          style={{
            overflow: "auto",
            maxHeight: "400px",
            borderRadius: "0.5rem",
            padding: "1rem",
            backgroundColor: "#1a202c",
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Model Metadata</h3>
          <pre className="text-xs overflow-auto max-h-60">
            {JSON.stringify(modelData.model, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Graph Summary</h3>
          <pre className="text-xs overflow-auto max-h-60">
            {JSON.stringify(
              {
                nodes: modelData.graph.nodes.length,
                inputs: modelData.graph.inputs.length,
                outputs: modelData.graph.outputs.length,
                initializers: modelData.graph.initializers.length,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Operator Frequency</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.keys(operatorFrequency).length > 0 ? (
            Object.entries(operatorFrequency).map(([op, count]) => (
              <div key={op} className="bg-white p-2 rounded shadow-sm">
                <span className="font-medium">{op}:</span> {count}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No operator frequency data available.</p>
          )}
        </div>
      </div>

      {/* React Flow Diagram Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-medium mb-2">Graph Visualization</h3>
        <div style={{ height: "400px", width: "100%" }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              attributionPosition="top-right"
            >
              <Background />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
};

export default ModelViewer;
