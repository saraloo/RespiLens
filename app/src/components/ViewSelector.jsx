import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useView } from '../contexts/ViewContext';
import { DATASETS } from '../config/datasets';

const ViewSelector = () => {
  const { 
    viewType, 
    setViewType,
    setSelectedDates,
    setSelectedModels
  } = useView();
  const [searchParams, setSearchParams] = useSearchParams();

  const getCurrentDataset = () => {
    return Object.values(DATASETS).find(dataset => 
      viewType.startsWith(dataset.shortName)
    ) || DATASETS.flu;
  };

  const handleViewChange = (newView) => {
    const currentDataset = getCurrentDataset();
    const newDataset = Object.values(DATASETS).find(dataset => 
      newView.startsWith(dataset.shortName)
    ) || DATASETS.flu;

    // Clear state if switching between different datasets
    if (currentDataset.shortName !== newDataset.shortName) {
      setSelectedDates([]);
      setSelectedModels([]);
      
      // Clear old parameters
      const newParams = new URLSearchParams(searchParams);
      newParams.delete(`${currentDataset.prefix}_dates`);
      newParams.delete(`${currentDataset.prefix}_models`);
      if (currentDataset.shortName === 'nhsn') {
        newParams.delete(`${currentDataset.prefix}_columns`);
      }

      // Set new view and location
      newParams.set('view', newView);
      newParams.set('location', searchParams.get('location'));
      setSearchParams(newParams, { replace: true });
    }

    setViewType(newView);
  };

  const currentDataset = getCurrentDataset();

  return (
    <select
      value={viewType}
      onChange={(e) => handleViewChange(e.target.value)}
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
