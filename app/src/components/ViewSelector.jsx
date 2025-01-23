import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useView } from '../contexts/ViewContext';

const ViewSelector = () => {
  const { viewType, setViewType } = useView();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewChange = (newView) => {
    setViewType(newView);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', newView);
    setSearchParams(newParams, { replace: true });
  };

  return (
    <select
      value={viewType}
      onChange={(e) => handleViewChange(e.target.value)}
      className="border rounded px-2 py-1 text-lg bg-white"
    >
      <option value="detailed">Flu - detailed</option>
      <option value="timeseries">Flu - timeseries</option>
      <option value="rsv">RSV View</option>
    </select>
  );
};

export default ViewSelector;
