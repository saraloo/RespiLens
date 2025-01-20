import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const AppContent = () => {
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

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
