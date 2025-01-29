import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useView } from '../contexts/ViewContext';

const ViewSelector = () => {
  const { 
    viewType, 
    setViewType,
    setSelectedDates,
    setSelectedModels
  } = useView();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewChange = (newView) => {
    const isViewTypeSwitch = (
      // RSV <-> Flu switch
      (viewType === 'rsvdetailed' && newView.includes('flu')) || 
      (viewType.includes('flu') && newView === 'rsvdetailed') ||
      // Any <-> NHSN switch
      (viewType === 'nhsnall' && newView !== 'nhsnall') ||
      (viewType !== 'nhsnall' && newView === 'nhsnall')
    );
    
    if (isViewTypeSwitch) {
      // First clear state
      setSelectedDates([]);
      setSelectedModels([]);
      
      // Then update view and params
      setViewType(newView);
      
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', newView);
      newParams.set('location', searchParams.get('location'));
      
      // Clear old parameters based on previous view type
      let oldPrefix;
      if (viewType === 'rsvdetailed') oldPrefix = 'rsv';
      else if (viewType.includes('flu')) oldPrefix = 'flu';
      else if (viewType === 'nhsnall') oldPrefix = 'nhsn';
      
      if (oldPrefix) {
        newParams.delete(`${oldPrefix}_dates`);
        newParams.delete(`${oldPrefix}_models`);
        newParams.delete(`${oldPrefix}_columns`); // For NHSN columns
      }
      
      setSearchParams(newParams, { replace: true });
    } else {
      // For flu view switches, preserve parameters
      setViewType(newView);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', newView);
      setSearchParams(newParams, { replace: true });
    }
  };

  return (
    <select
      value={viewType}
      onChange={(e) => handleViewChange(e.target.value)}
      className="border rounded px-2 py-1 text-lg bg-white"
    >
      <option value="fludetailed">Flu - detailed</option>
      <option value="flutimeseries">Flu - timeseries</option>
      <option value="rsvdetailed">RSV View</option>
      <option value="nhsnall">NHSN - raw</option>
    </select>
  );
};

export default ViewSelector;
