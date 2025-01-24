import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useView } from '../contexts/ViewContext';

const ViewSelector = () => {
  const { viewType, setViewType, resetViews } = useView();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewChange = (newView) => {
    // Determine if switching between RSV and Flu
    const isRSVSwitch = (viewType === 'rsvdetailed' && newView.includes('flu')) || 
                        (viewType.includes('flu') && newView === 'rsvdetailed');
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', newView);
    newParams.set('location', searchParams.get('location'));
    
    // Clear old pathogen's params when switching between RSV/Flu
    if (isRSVSwitch) {
      // Clear old pathogen's params
      const oldPrefix = viewType === 'rsvdetailed' ? 'rsv' : 'flu';
      newParams.delete(`${oldPrefix}_dates`);
      newParams.delete(`${oldPrefix}_models`);
      
      // First update URL params
      setSearchParams(newParams, { replace: true });
      
      // Then update view type (this will trigger a data fetch)
      setViewType(newView);
      
      // Finally reset to defaults (this must happen after view type change)
      resetViews();
    } else {
      // For flu view switches, preserve parameters
      const dates = searchParams.get('flu_dates');
      const models = searchParams.get('flu_models');
      if (dates) newParams.set('flu_dates', dates);
      if (models) newParams.set('flu_models', models);
      
      setSearchParams(newParams, { replace: true });
      setViewType(newView);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <select
        value={viewType}
        onChange={(e) => handleViewChange(e.target.value)}
        className="border rounded px-2 py-1 text-lg bg-white"
      >
        <option value="fludetailed">Flu - detailed</option>
        <option value="flutimeseries">Flu - timeseries</option>
        <option value="rsvdetailed">RSV View</option>
      </select>
      <button 
        onClick={() => {
          resetViews();
          const newParams = new URLSearchParams();
          newParams.set('view', viewType);
          newParams.set('location', searchParams.get('location'));
          setSearchParams(newParams, { replace: true });
        }}
        className="px-2 py-1 border rounded hover:bg-gray-100"
      >
        Reset Views
      </button>
    </div>
  );
};

export default ViewSelector;
