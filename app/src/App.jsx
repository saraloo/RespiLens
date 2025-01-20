import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, useSearchParams } from 'react-router-dom';
import StateSelector from './components/StateSelector';
import ForecastViz from './components/ForecastViz';

const AppContent = () => {
  useEffect(() => {
    document.title = 'RespiView';
  }, []);
  const [searchParams] = useSearchParams();
  const [selectedLocation, setSelectedLocation] = useState(() => {
    // Initialize location from URL if present
    return searchParams.get('location') || null;
  });

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
