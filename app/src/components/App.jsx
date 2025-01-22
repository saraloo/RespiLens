import React, { useState } from 'react';
import { useURLState } from '../hooks/useURLState';
import StateSelector from './StateSelector';
import ForecastViz from './ForecastViz';

const App = () => {
  const [getURLState, updateURLState] = useURLState();
  const { location } = getURLState();
  const [selectedLocation, setSelectedLocation] = useState(location);

  const handleStateSelect = (newLocation) => {
    updateURLState({ location: newLocation });
    setSelectedLocation(newLocation);
  };

  const handleBack = () => {
    // Preserve models and dates when going back
    const { models, dates } = getURLState();
    updateURLState({ location: null, models, dates });
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
