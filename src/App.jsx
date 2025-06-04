import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ModelViewer from './components/ModelViewer';
import { parseONNXModelComplete } from './ONNXParser';

function App() {
  const [modelData, setModelData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const parsedData = await parseONNXModelComplete(file);
      setModelData(parsedData);
    } catch (err) {
      setError('Failed to parse the ONNX model. Please make sure the file is valid.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">ONNX Model Parser</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Upload ONNX Model</h2>
          <FileUpload onFileUpload={handleFileUpload} />
        </div>

        {isLoading && (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8" role="alert">
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Model Information</h2>
          <ModelViewer modelData={modelData} />
        </div>
      </div>
    </div>
  );
}

export default App;