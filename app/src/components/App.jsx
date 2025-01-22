import React, { useState } from 'react';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const App = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);

  if (!selectedLocation) {
    return <StateSelector onStateSelect={setSelectedLocation} />;
  }

  return (
    <ForecastViz 
      location={selectedLocation} 
      onBack={() => setSelectedLocation(null)} 
    />
  );
};

export default App;