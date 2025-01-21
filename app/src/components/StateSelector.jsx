import React, { useState, useEffect } from 'react';

const StateSelector = ({ onStateSelect }) => {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        // Fetch manifest
        const manifestResponse = await fetch('/processed_data/metadata.json');
        if (!manifestResponse.ok) {
          throw new Error(`Failed to fetch metadata: ${manifestResponse.statusText}`);
        }
        
        const metadata = await manifestResponse.json();
        console.log('Loaded metadata:', metadata);

        if (!metadata.locations || !Array.isArray(metadata.locations)) {
          throw new Error('Invalid metadata format');
        }

        // Use the locations data directly from metadata
        const sortedLocations = metadata.locations.sort((a, b) => 
          (a.location_name || '').localeCompare(b.location_name || ''));
        
        setStates(sortedLocations);
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
      <div className="flex items-center justify-center gap-4 mb-6">
        <img src="respiview-logo.svg" alt="FluView Logo" className="h-14 w-14" />
        <h1 className="text-3xl font-bold">FluView</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {states.map((state) => (
          <div
            key={state.location}
            onClick={() => onStateSelect(state.abbreviation)}
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
