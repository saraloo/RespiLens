import React from 'react';

const ModelSelector = ({ 
  models = [],
  selectedModels = [], 
  setSelectedModels,
  getModelColor,
  allowMultiple = true,
  disabled = false
}) => {
  const toggleModelSelection = (model) => {
    if (!allowMultiple) {
      setSelectedModels([model]);
      return;
    }
    
    setSelectedModels(prev => 
      prev.includes(model)
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  if (!models.length) {
    return (
      <div className="text-gray-500 italic">
        No models available
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-4">
      {allowMultiple && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setSelectedModels(models)}
            className="px-3 py-1 rounded text-sm border hover:bg-gray-100 disabled:opacity-50"
            disabled={disabled}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedModels([])}
            className="px-3 py-1 rounded text-sm border hover:bg-gray-100 disabled:opacity-50"
            disabled={disabled}
          >
            Select None
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {models.map(model => (
          <div
            key={model}
            onClick={() => !disabled && toggleModelSelection(model)}
            className={`px-3 py-1 rounded cursor-pointer text-sm transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              selectedModels.includes(model)
                ? 'text-white'
                : 'border hover:bg-gray-100'
            }`}
            style={
              selectedModels.includes(model) 
                ? { backgroundColor: getModelColor(model, selectedModels) }
                : undefined
            }
          >
            {model}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
