import React, { createContext, useContext, useState } from 'react';

const ViewContext = createContext(null);

export const ViewProvider = ({ children }) => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [viewType, setViewType] = useState('fludetailed');

  const resetViews = () => {
    // Clear model selection
    setSelectedModels([]);
    
    // Keep current view type but reset URL params
    const params = new URLSearchParams(window.location.search);
    const prefix = viewType === 'rsv' ? 'rsv' : 'flu';
    params.delete(`${prefix}_dates`);
    params.delete(`${prefix}_models`);
    window.history.replaceState({}, '', `?${params.toString()}`);
    
    // Set default model based on view type
    const defaultModel = viewType === 'rsv' ? 'hub-ensemble' : 'FluSight-ensemble';
    setSelectedModels([defaultModel]);
    
    // Clear date selection to trigger default date setting
    setSelectedDates([]);
    setActiveDate(null);
  };

  return (
    <ViewContext.Provider value={{
      selectedModels, setSelectedModels,
      selectedDates, setSelectedDates,
      activeDate, setActiveDate,
      viewType, setViewType,
      resetViews
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
