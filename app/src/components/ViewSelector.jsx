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
    
    setViewType(newView);
    if (isRSVSwitch) {
      resetViews();
    }
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', newView);
    newParams.set('location', searchParams.get('location'));
    
    // Preserve params based on view type
    if (!isRSVSwitch) {
      const prefix = viewType === 'rsvdetailed' ? 'rsv' : 'flu';
      const dates = searchParams.get(`${prefix}_dates`);
      const models = searchParams.get(`${prefix}_models`);
      if (dates) newParams.set(`${prefix}_dates`, dates);
      if (models) newParams.set(`${prefix}_models`, models);
    }
    
    setSearchParams(newParams, { replace: true });
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
