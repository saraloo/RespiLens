import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useView } from '../contexts/ViewContext';

const ViewSelector = () => {
  const { viewType, setViewType, resetViews } = useView();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewChange = (newView) => {
    setViewType(newView);
    resetViews();
    const newParams = new URLSearchParams();
    newParams.set('view', newView);
    newParams.set('location', searchParams.get('location'));
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="flex gap-2 items-center">
      <select
        value={viewType}
        onChange={(e) => handleViewChange(e.target.value)}
        className="border rounded px-2 py-1 text-lg bg-white"
      >
        <option value="detailed">Flu - detailed</option>
        <option value="timeseries">Flu - timeseries</option>
        <option value="rsv">RSV View</option>
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
