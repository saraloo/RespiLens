import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLocation, setSelectedLocation] = useState(() => {
    // Initialize from URL if present
    return searchParams.get('location') || null;
  });

  const handleStateSelect = (location) => {
    // Preserve existing params when changing location
    const newParams = {};
    searchParams.forEach((value, key) => {
      newParams[key] = value;
    });
    newParams.location = location;
    setSearchParams(newParams);
    setSelectedLocation(location);
  };

  const handleBack = () => {
    // Clear only location from URL, preserving other params
    const newParams = {};
    searchParams.forEach((value, key) => {
      if (key !== 'location') {
        newParams[key] = value;
      }
    });
    setSearchParams(newParams);
    setSelectedLocation(null);
  };

  if (!selectedLocation) {
    return <StateSelector onStateSelect={handleStateSelect} />;
  }

  return (
    <ForecastViz 
      location={selectedLocation} 
      onBack={handleBack} 
    />
  );
};

export default App;
