import React, { createContext, useContext, useState } from 'react';

const ViewContext = createContext(null);

export const ViewProvider = ({ children }) => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [viewType, setViewType] = useState('detailed');

  const resetViews = () => {
    // Clear all selections
    setSelectedModels([]);
    setSelectedDates([]);
    setActiveDate(null);
    
    // Keep current view type but reset URL params
    const params = new URLSearchParams(window.location.search);
    params.delete('flu_dates');
    params.delete('flu_models');
    params.delete('rsv_dates');
    params.delete('rsv_models');
    window.history.replaceState({}, '', `?${params.toString()}`);
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
