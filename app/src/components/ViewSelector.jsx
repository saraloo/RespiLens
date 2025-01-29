import React from 'react';
import { useView } from '../contexts/ViewContext';
import { DATASETS } from '../config/datasets';

const ViewSelector = () => {
  const { 
    viewType, 
    setViewType,
    urlManager
  } = useView();

  const currentDataset = urlManager.getDatasetFromView(viewType);

  return (
    <select
      value={viewType}
      onChange={(e) => setViewType(e.target.value)}
      className="border rounded px-2 py-1 text-lg bg-white"
    >
      {Object.values(DATASETS).map(dataset => (
        dataset.views.map(view => (
          <option 
            key={`${dataset.shortName}-${view}`}
            value={`${dataset.shortName}${view}`}
          >
            {dataset.fullName} - {view}
          </option>
        ))
      ))}
    </select>
  );
};

export default ViewSelector;
