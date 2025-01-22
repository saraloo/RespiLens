import React, { createContext, useContext, useState } from 'react';

const ViewContext = createContext(null);

export const ViewProvider = ({ children }) => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [viewType, setViewType] = useState('detailed');

  return (
    <ViewContext.Provider value={{
      selectedModels, setSelectedModels,
      selectedDates, setSelectedDates,
      activeDate, setActiveDate,
      viewType, setViewType
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
