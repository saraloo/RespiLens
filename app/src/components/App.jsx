import React, { useState } from 'react';
import { useURLState } from '../hooks/useURLState';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const App = () => {
  const [getURLState, updateURLState] = useURLState();
  const { location } = getURLState();
  const [selectedLocation, setSelectedLocation] = useState(location);

  const handleStateSelect = (newLocation) => {
    updateURLState({ location: newLocation });
    setSelectedLocation(newLocation);
  };

  const handleBack = () => {
    updateURLState({ location: null });
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
