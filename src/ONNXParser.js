// src/utils/parseONNXModel.js
import protobuf from 'protobufjs';

export const parseONNXModelComplete = async (file) => {
  try {
    const root = await protobuf.load('/onnx.proto'); // <- Serve it from public folder
    const ModelProto = root.lookupType('onnx.ModelProto');

    const buffer = await file.arrayBuffer();
    const decoded = ModelProto.decode(new Uint8Array(buffer));
    const model = ModelProto.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true,
    });

    // operator frequency
    const operatorFrequency = {};
    const nodes = model.graph?.node || [];
    for (const node of nodes) {
      const op = node.opType;
      if (op) operatorFrequency[op] = (operatorFrequency[op] || 0) + 1;
    }

    return {
      file: {
        name: file.name,
        size: file.size,
        sizeFormatted: `${(file.size / 1024).toFixed(2)} KB`,
      },
      model: {
        producerName: model.producerName || 'Unknown',
        producerVersion: model.producerVersion || 'Unknown',
      },
      graph: {
        inputs: model.graph.input?.map(i => ({ name: i.name, type: i.type?.value || 'unknown' })) || [],
        outputs: model.graph.output?.map(o => ({ name: o.name, type: o.type?.value || 'unknown' })) || [],
        nodes,
        initializers: model.graph.initializer || [],
      },
      analysis: {
        totalInputs: model.graph.input?.length || 0,
        totalOutputs: model.graph.output?.length || 0,
        totalNodes: nodes.length,
        totalInitializers: model.graph.initializer?.length || 0,
        modelComplexity: nodes.length > 1000 ? 'High' : nodes.length > 100 ? 'Medium' : 'Low',
        operatorFrequency,
      },
      parsingMethod: 'runtime-load',
    };
  } catch (err) {
    return {
      error: err.message,
      parsingMethod: 'fallback',
    };
  }
};
