import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Rect, Text, Line, Group, Arrow } from 'react-konva';
import ELK from 'elkjs/lib/elk.bundled.js';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;
const INPUT_NODE_WIDTH = 140;
const INPUT_NODE_HEIGHT = 80;
const OUTPUT_NODE_WIDTH = 140;
const OUTPUT_NODE_HEIGHT = 80;

const getConvDetails = (node) => {
  const attrs = node.attribute || [];
  const getAttrValue = (name) => {
    const attr = attrs.find((a) => a.name === name);
    return attr?.ints?.join('×') || '–';
  };

  const W = node.input?.find((i) => i.includes('weight')) || 'W';
  const B = node.input?.find((i) => i.includes('bias')) || 'B';

  return [
    `Weight: ${W}`,
    `Bias: ${B}`,
    `Dilations: ${getAttrValue('dilations')}`,
    `Kernel: ${getAttrValue('kernel_shape')}`,
    `Padding: ${getAttrValue('pads')}`,
    `Strides: ${getAttrValue('strides')}`
  ];
};

const getNodeColor = (nodeType) => {
  const colors = {
    'Conv': { fill: '#3498db', shadow: '#2980b9' },
    'ReLU': { fill: '#e74c3c', shadow: '#c0392b' },
    'MaxPool': { fill: '#f39c12', shadow: '#e67e22' },
    'BatchNorm': { fill: '#9b59b6', shadow: '#8e44ad' },
    'Linear': { fill: '#1abc9c', shadow: '#16a085' },
    'Dropout': { fill: '#95a5a6', shadow: '#7f8c8d' },
    'Input': { fill: '#2ecc71', shadow: '#27ae60' },
    'Output': { fill: '#e67e22', shadow: '#d35400' },
    'default': { fill: '#34495e', shadow: '#2c3e50' }
  };
  return colors[nodeType] || colors.default;
};

const ModernCanvas = ({ modelData }) => {
  const [graph, setGraph] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(800, rect.width - 40),
          height: Math.max(600, rect.height - 40)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!modelData?.graph?.nodes) {
      // Create demo data if no model data provided
      const demoData = {
        graph: {
          inputs: [{ name: 'input_tensor' }],
          outputs: [{ name: 'output_tensor' }],
          nodes: [
            {
              opType: 'Conv',
              input: ['input_tensor', 'conv_weight', 'conv_bias'],
              output: ['conv_out'],
              attribute: [
                { name: 'kernel_shape', ints: [3, 3] },
                { name: 'strides', ints: [1, 1] },
                { name: 'pads', ints: [1, 1] },
                { name: 'dilations', ints: [1, 1] }
              ]
            },
            {
              opType: 'ReLU',
              input: ['conv_out'],
              output: ['relu_out']
            },
            {
              opType: 'MaxPool',
              input: ['relu_out'],
              output: ['pool_out'],
              attribute: [
                { name: 'kernel_shape', ints: [2, 2] },
                { name: 'strides', ints: [2, 2] }
              ]
            },
            {
              opType: 'Linear',
              input: ['pool_out', 'linear_weight'],
              output: ['output_tensor']
            }
          ]
        }
      };
      setGraph(null);
      setTimeout(() => layoutGraph(demoData), 100);
      return;
    }

    layoutGraph(modelData);
  }, [modelData]);

  const layoutGraph = async (data) => {
    const elk = new ELK();

    const allNodes = data.graph.nodes.map((node) => {
      const isConv = node.opType === 'Conv';
      const lines = isConv ? [node.opType, ...getConvDetails(node)] : [node.opType];
      return {
        id: node.output[0],
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        labels: lines.map((text) => ({ text })),
        nodeType: node.opType,
        originalNode: node
      };
    });

    const inputs = data.graph.inputs.map((input) => ({
      id: input.name,
      width: INPUT_NODE_WIDTH,
      height: INPUT_NODE_HEIGHT,
      labels: [{ text: input.name }],
      nodeType: 'Input'
    }));

    const outputs = data.graph.outputs.map((output) => ({
      id: output.name,
      width: OUTPUT_NODE_WIDTH,
      height: OUTPUT_NODE_HEIGHT,
      labels: [{ text: output.name }],
      nodeType: 'Output'
    }));

    const allChildren = [...inputs, ...allNodes, ...outputs];

    const edges = [];
    data.graph.nodes.forEach((node) => {
      node.input.forEach((input) => {
        edges.push({
          id: `${input}->${node.output[0]}`,
          sources: [input],
          targets: [node.output[0]],
        });
      });
    });

    data.graph.outputs.forEach((output) => {
      const lastNode = data.graph.nodes.find(n => n.output.includes(output.name));
      if (lastNode) {
        edges.push({
          id: `${lastNode.output[0]}->${output.name}`,
          sources: [lastNode.output[0]],
          targets: [output.name],
        });
      }
    });

    try {
      const layoutedGraph = await elk.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '80',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.spacing.edgeNode': '40',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP'
        },
        children: allChildren,
        edges,
      });
      setGraph(layoutedGraph);
    } catch (error) {
      console.error('Layout error:', error);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(3, newScale));
    
    setScale(clampedScale);
    setPosition({
      x: -(mousePointTo.x - stage.getPointerPosition().x / clampedScale) * clampedScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / clampedScale) * clampedScale,
    });
  };

  const NodeComponent = ({ node, isHovered, isSelected }) => {
    const colors = getNodeColor(node.nodeType);
    const shadowOffset = isHovered ? 8 : 4;
    const shadowBlur = isHovered ? 15 : 10;
    
    return (
      <Group
        x={node.x}
        y={node.y}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
        style={{ cursor: 'pointer' }}
      >
        {/* Shadow */}
        <Rect
          width={node.width}
          height={node.height}
          fill={colors.shadow}
          cornerRadius={15}
          x={shadowOffset}
          y={shadowOffset}
          opacity={0.3}
          blur={shadowBlur}
        />
        
        {/* Main rectangle */}
        <Rect
          width={node.width}
          height={node.height}
          fill={colors.fill}
          cornerRadius={15}
          stroke={isSelected ? '#ffffff' : isHovered ? '#ecf0f1' : 'transparent'}
          strokeWidth={isSelected ? 3 : isHovered ? 2 : 0}
          shadowColor={colors.shadow}
          shadowBlur={5}
          shadowOpacity={0.6}
        />
        
        {/* Gradient overlay */}
        <Rect
          width={node.width}
          height={node.height}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: node.height }}
          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.2)', 1, 'rgba(0,0,0,0.1)']}
          cornerRadius={15}
        />
        
        {/* Text content */}
        {node.labels.map((label, i) => (
          <Text
            key={i}
            text={label.text}
            x={15}
            y={15 + i * 18}
            fontSize={i === 0 ? 16 : 12}
            fontFamily="Arial, sans-serif"
            fontStyle={i === 0 ? 'bold' : 'normal'}
            fill="#ffffff"
            shadowColor="rgba(0,0,0,0.5)"
            shadowBlur={2}
            shadowOffset={{ x: 1, y: 1 }}
          />
        ))}
      </Group>
    );
  };

  const ArrowComponent = ({ edge, fromNode, toNode }) => {
    if (!fromNode || !toNode) return null;

    const fromX = fromNode.x + fromNode.width;
    const fromY = fromNode.y + fromNode.height / 2;
    const toX = toNode.x;
    const toY = toNode.y + toNode.height / 2;

    const midX = (fromX + toX) / 2;
    const isHovered = hoveredNode === fromNode.id || hoveredNode === toNode.id;

    return (
      <Arrow
        key={edge.id}
        points={[fromX, fromY, midX, fromY, midX, toY, toX, toY]}
        stroke={isHovered ? '#3498db' : '#ecf0f1'}
        strokeWidth={isHovered ? 3 : 2}
        fill={isHovered ? '#3498db' : '#ecf0f1'}
        pointerLength={12}
        pointerWidth={8}
        tension={0.3}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={5}
        shadowOpacity={0.6}
      />
    );
  };

  if (!graph) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Loading neural network visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Neural Network Visualizer</h1>
            <p className="text-blue-200">Interactive model architecture explorer</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              <span className="opacity-75">Zoom: {Math.round(scale * 100)}%</span>
            </div>
            <button
              onClick={() => {
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-20 right-4 z-10 bg-black bg-opacity-70 backdrop-blur-sm rounded-lg p-4 max-w-xs">
        <h3 className="text-white font-semibold mb-3">Layer Types</h3>
        <div className="space-y-2 text-sm">
          {['Conv', 'ReLU', 'MaxPool', 'Linear', 'Input', 'Output'].map(type => {
            const colors = getNodeColor(type);
            return (
              <div key={type} className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: colors.fill }}
                ></div>
                <span className="text-white">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-80 backdrop-blur-sm rounded-lg p-4 max-w-md">
          <h3 className="text-white font-semibold mb-2">Node Details</h3>
          <div className="text-sm text-blue-200">
            <p><strong>ID:</strong> {selectedNode}</p>
            <p><strong>Type:</strong> {graph.children.find(n => n.id === selectedNode)?.nodeType}</p>
          </div>
        </div>
      )}

      {/* Canvas */}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
        className="mt-20"
      >
        <Layer>
          {/* Render arrows first (behind nodes) */}
          {graph.edges.map((edge) => {
            const fromNode = graph.children.find(n => n.id === edge.sources[0]);
            const toNode = graph.children.find(n => n.id === edge.targets[0]);
            return (
              <ArrowComponent
                key={edge.id}
                edge={edge}
                fromNode={fromNode}
                toNode={toNode}
              />
            );
          })}
          
          {/* Render nodes */}
          {graph.children.map((node) => (
            <NodeComponent
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              isSelected={selectedNode === node.id}
            />
          ))}
        </Layer>
      </Stage>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex space-x-2">
        <button
          onClick={() => setScale(Math.min(3, scale * 1.2))}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
          title="Zoom In"
        >
          <span className="text-lg">+</span>
        </button>
        <button
          onClick={() => setScale(Math.max(0.1, scale / 1.2))}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
          title="Zoom Out"
        >
          <span className="text-lg">-</span>
        </button>
      </div>
    </div>
  );
};

export default ModernCanvas;