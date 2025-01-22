import { useSearchParams } from 'react-router-dom';

export function useURLState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getURLState = () => ({
    location: searchParams.get('location'),
    dates: searchParams.get('dates')?.split(',') || [],
    models: searchParams.get('models')?.split(',') || []
  });

  const updateURLState = (updates) => {
    const currentState = getURLState();
    const newState = { ...currentState, ...updates };
    
    // Remove empty/null values
    Object.keys(newState).forEach(key => {
      if (!newState[key] || 
          (Array.isArray(newState[key]) && newState[key].length === 0)) {
        delete newState[key];
      }
    });

    // Convert arrays back to strings
    if (newState.dates) newState.dates = newState.dates.join(',');
    if (newState.models) newState.models = newState.models.join(',');

    setSearchParams(newState);
  };

  return [getURLState, updateURLState];
}
