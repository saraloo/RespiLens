import React, { useState, useEffect } from 'react';

const StateSelector = ({ onStateSelect }) => {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        // Fetch manifest
        const manifestResponse = await fetch('/processed_data/manifest.json');
        if (!manifestResponse.ok) {
          throw new Error(`Failed to fetch manifest: ${manifestResponse.statusText}`);
        }
        
        const manifest = await manifestResponse.json();
        console.log('Loaded manifest:', manifest);

        if (!manifest.locations || !Array.isArray(manifest.locations)) {
          throw new Error('Invalid manifest format');
        }

        // Fetch data for each location
        const statesData = [];
        for (const loc of manifest.locations) {
          try {
            const response = await fetch(`/processed_data/${loc}.json`);
            if (!response.ok) {
              console.error(`Failed to fetch data for location ${loc}`);
              continue;
            }
            const data = await response.json();
            if (data.metadata) {
              statesData.push(data.metadata);
            }
          } catch (err) {
            console.error(`Error loading location ${loc}:`, err);
          }
        }

        if (statesData.length === 0) {
          throw new Error('No location data could be loaded');
        }

        // Sort states by name
        statesData.sort((a, b) => 
          (a.location_name || '').localeCompare(b.location_name || ''));
        
        setStates(statesData);
        setLoading(false);
      } catch (err) {
        console.error('Error in data loading:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStates();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="mb-2">Loading locations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="text-red-500 text-center mb-4">
          Error: {error}
        </div>
        <div className="text-sm text-gray-600 max-w-lg text-center">
          Please ensure that:
          <ul className="list-disc text-left mt-2 space-y-1">
            <li>The process_flusight_data.py script has been run</li>
            <li>Data files are present in app/public/processed_data/</li>
            <li>manifest.json contains valid location data</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">FluSight Forecast Visualization</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {states.map((state) => (
          <div
            key={state.location}
            onClick={() => onStateSelect(state.location)}
            className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            <h2 className="text-xl font-semibold">{state.location_name || state.location}</h2>
            {state.population && (
              <p className="text-gray-600 text-sm">
                Population: {state.population.toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateSelector;