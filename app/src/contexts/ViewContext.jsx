import React, { createContext, useContext, useState } from 'react';
import { DATASETS } from '../config/datasets';

const ViewContext = createContext(null);

export const ViewProvider = ({ children }) => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [viewType, setViewType] = useState('fludetailed');

  const getCurrentDataset = () => {
    return Object.values(DATASETS).find(dataset => 
      viewType.startsWith(dataset.shortName)
    ) || DATASETS.flu;
  };

  const resetViews = () => {
    const currentDataset = getCurrentDataset();
    
    // Clear model selection
    setSelectedModels([]);
    
    // Reset URL params
    const params = new URLSearchParams(window.location.search);
    params.delete(`${currentDataset.prefix}_dates`);
    params.delete(`${currentDataset.prefix}_models`);
    if (currentDataset.shortName === 'nhsn') {
      params.delete(`${currentDataset.prefix}_columns`);
    }
    window.history.replaceState({}, '', `?${params.toString()}`);
    
    // Set default model
    setSelectedModels([currentDataset.defaultModel]);
    
    // Set most recent date
    if (window.availableDates?.length > 0) {
      const latestDate = window.availableDates[window.availableDates.length - 1];
      setSelectedDates([latestDate]);
      setActiveDate(latestDate);
    } else {
      setSelectedDates([]);
      setActiveDate(null);
    }
  };

  return (
    <ViewContext.Provider value={{
      selectedModels, setSelectedModels,
      selectedDates, setSelectedDates,
      activeDate, setActiveDate,
      viewType, setViewType,
      resetViews,
      getCurrentDataset
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
