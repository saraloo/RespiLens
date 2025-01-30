import React from 'react';
import { useView } from '../contexts/ViewContext';
import ModelSelector from './ModelSelector';

const COLUMN_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];

const NHSNColumnSelector = ({ 
  availableColumns,
  selectedColumns,
  setSelectedColumns,
}) => {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div>
        <h3 className="font-bold mb-2">Official Data Columns</h3>
        <ModelSelector
          models={availableColumns.official}
          selectedModels={selectedColumns.filter(c => !c.includes('_prelim'))}
          setSelectedModels={(newSelection) => {
            setSelectedColumns([
              ...newSelection,
              ...selectedColumns.filter(c => c.includes('_prelim'))
            ]);
          }}
          getModelColor={(model) => {
            const index = availableColumns.official.indexOf(model);
            return COLUMN_COLORS[index % COLUMN_COLORS.length];
          }}
        />
      </div>
      
      <div>
        <h3 className="font-bold mb-2">Preliminary Data Columns</h3>
        <ModelSelector
          models={availableColumns.preliminary}
          selectedModels={selectedColumns.filter(c => c.includes('_prelim'))}
          setSelectedModels={(newSelection) => {
            setSelectedColumns([
              ...selectedColumns.filter(c => !c.includes('_prelim')),
              ...newSelection
            ]);
          }}
          getModelColor={(model) => {
            const index = availableColumns.preliminary.indexOf(model);
            return COLUMN_COLORS[(index + availableColumns.official.length) % COLUMN_COLORS.length];
          }}
        />
      </div>
    </div>
  );
};

export default NHSNColumnSelector;
