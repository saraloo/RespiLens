import React, { createContext, useContext, useState, useMemo } from 'react';
import { DATASETS } from '../config/datasets';
import { URLParameterManager } from '../utils/urlManager';

const ViewContext = createContext(null);

export const ViewProvider = ({ children }) => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [viewType, setViewType] = useState('fludetailed');
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));

  // Create URL manager instance
  const urlManager = useMemo(() => 
    new URLParameterManager(searchParams, setSearchParams),
    [searchParams]
  );

  const getCurrentDataset = () => {
    return urlManager.getDatasetFromView(viewType) || DATASETS.flu;
  };

  // Update URL parameters when state changes
  const updateURLParams = () => {
    const dataset = getCurrentDataset();
    urlManager.updateDatasetParams(dataset, {
      dates: selectedDates,
      models: selectedModels
    });
  };

  // Handle view type changes
  const handleViewChange = (newView) => {
    urlManager.handleViewChange(viewType, newView);
    setViewType(newView);
  };

  const resetViews = () => {
    const dataset = getCurrentDataset();
    
    // Clear state
    setSelectedModels([]);
    setSelectedDates([]);
    setActiveDate(null);
    
    // Clear URL params
    urlManager.clearDatasetParams(dataset);
    
    // Set default model
    setSelectedModels([dataset.defaultModel]);
    
    // Set most recent date
    if (window.availableDates?.length > 0) {
      const latestDate = window.availableDates[window.availableDates.length - 1];
      setSelectedDates([latestDate]);
      setActiveDate(latestDate);
    }
  };

  // Initialize state from URL params on mount
  useEffect(() => {
    const dataset = getCurrentDataset();
    const params = urlManager.getDatasetParams(dataset);
    
    if (params.dates.length > 0) {
      setSelectedDates(params.dates);
      setActiveDate(params.dates[params.dates.length - 1]);
    }
    
    if (params.models.length > 0) {
      setSelectedModels(params.models);
    } else {
      setSelectedModels([dataset.defaultModel]);
    }
  }, []);

  // Update URL params when state changes
  useEffect(() => {
    updateURLParams();
  }, [selectedDates, selectedModels, viewType]);

  return (
    <ViewContext.Provider value={{
      selectedModels, setSelectedModels,
      selectedDates, setSelectedDates,
      activeDate, setActiveDate,
      viewType, 
      setViewType: handleViewChange,
      resetViews,
      getCurrentDataset,
      urlManager
    }}>
      {children}
    </ViewContext.Provider>
  );
};

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
};
