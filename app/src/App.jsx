import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, useSearchParams } from 'react-router-dom';
import { ViewProvider } from './contexts/ViewContext';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const AppContent = () => {
  useEffect(() => {
    document.title = 'RespiView';
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLocation, setSelectedLocation] = useState(() => {
    return searchParams.get('location') || null;
  });

  const handleStateSelect = (newLocation) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('location', newLocation);
    setSearchParams(newParams);
    setSelectedLocation(newLocation);
  };

  if (!selectedLocation) {
    return <StateSelector onStateSelect={handleStateSelect} />;
  }

  return (
    <ForecastViz 
      location={selectedLocation} 
      onBack={() => {
        setSelectedLocation(null);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('location');
        setSearchParams(newParams);
      }} 
    />
  );
};

const App = () => (
  <Router>
    <ViewProvider>
      <AppContent />
    </ViewProvider>
  </Router>
);

export default App;
