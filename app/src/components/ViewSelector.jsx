import React from 'react';
import { useView } from '../contexts/ViewContext';
import { DATASETS } from '../config/datasets';

const ViewSelector = () => {
  const { viewType, setViewType, currentDataset } = useView();

  // Generate all possible view options
  const viewOptions = Object.values(DATASETS).flatMap(dataset => 
    dataset.views.map(view => ({
      value: `${dataset.shortName}${view}`,
      label: `${dataset.fullName} - ${view}`,
      dataset: dataset.shortName
    }))
  );

  return (
    <select
      value={viewType}
      onChange={(e) => setViewType(e.target.value)}
      className="border rounded px-2 py-1 text-lg bg-white"
    >
      {viewOptions.map(option => (
        <option 
          key={option.value} 
          value={option.value}
          // Optionally group options by dataset
          className={`${option.dataset === currentDataset?.shortName ? 'font-bold' : ''}`}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default ViewSelector;
