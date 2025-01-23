import React, { useState, useEffect, useCallback } from 'react';
import RSVDefaultView from './RSVDefaultView';
import InfoOverlay from './InfoOverlay';
import { useView } from '../contexts/ViewContext';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import ViewSelector from './ViewSelector';
import Plot from 'react-plotly.js';

// Color palette for model visualization
const MODEL_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const getModelColor = (model, selectedModels) => {
  const index = selectedModels.indexOf(model);
  return index >= 0 ? MODEL_COLORS[index % MODEL_COLORS.length] : null;
};

const ForecastViz = ({ location, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    selectedModels, setSelectedModels,
    selectedDates, setSelectedDates,
    activeDate, setActiveDate,
    viewType, setViewType
  } = useView();
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize selections from URL/defaults when data loads
  useEffect(() => {
    if (!loading && data && availableDates.length > 0 && models.length > 0 && 
        (selectedDates.length === 0 || selectedModels.length === 0)) {
      // Only set from URL/defaults on initial load when selections are empty
      const urlDates = searchParams.get('dates')?.split(',') || [];
      const urlModels = searchParams.get('models')?.split(',') || [];
      
      if (selectedDates.length === 0) {
        const validDates = urlDates.filter(date => availableDates.includes(date));
        if (validDates.length > 0) {
          setSelectedDates(validDates);
          setActiveDate(validDates[0]);
        } else {
          setSelectedDates([availableDates[availableDates.length - 1]]);
          setActiveDate(availableDates[availableDates.length - 1]);
        }
      }
      
      if (selectedModels.length === 0) {
        const validModels = urlModels.filter(model => models.includes(model));
        if (validModels.length > 0) {
          setSelectedModels(validModels);
        } else {
          setSelectedModels(models.includes('FluSight-ensemble') ? ['FluSight-ensemble'] : [models[0]]);
        }
      }
    }
  }, [loading, data, availableDates, models]);

  // Update URL when selections change
  useEffect(() => {
    if (selectedDates.length > 0 && selectedModels.length > 0) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('dates', selectedDates.join(','));
      newParams.set('models', selectedModels.join(','));
      newParams.set('location', location);
      setSearchParams(newParams, { replace: true });
    }
  }, [selectedDates, selectedModels]);

  const getDefaultRange = useCallback((forRangeslider = false) => {
    if (!data || selectedDates.length === 0) return undefined;
    
    // Find first and last ground truth dates
    const firstGroundTruthDate = new Date(data.ground_truth.dates[0]);
    const lastGroundTruthDate = new Date(data.ground_truth.dates[data.ground_truth.dates.length - 1]);
    
    if (forRangeslider) {
      // For rangeslider: extend from first ground truth to 5 weeks after last ground truth
      const rangesliderEnd = new Date(lastGroundTruthDate);
      rangesliderEnd.setDate(rangesliderEnd.getDate() + (5 * 7));
      return [firstGroundTruthDate, rangesliderEnd];
    }
    
    // Default plot range (existing logic)
    const firstDate = new Date(selectedDates[0]);
    const lastDate = new Date(selectedDates[selectedDates.length - 1]);
    
    const startDate = new Date(firstDate);
    const endDate = new Date(lastDate);
    
    startDate.setDate(startDate.getDate() - (8 * 7));
    endDate.setDate(endDate.getDate() + (5 * 7));
    
    return [startDate, endDate];
  }, [data, selectedDates]);



  useEffect(() => {
    // Reset data when view changes 
    setData(null);
    setLoading(true);
    
    const fetchData = async () => {
      try {
        const isRSV = viewType === 'rsv';
        const response = await fetch(`./processed_data/${isRSV ? 'rsv' : 'flu'}/${location}_${isRSV ? 'rsv' : 'flusight'}.json`);
        if (!response.ok) throw new Error('No data available');
        const jsonData = await response.json();
        
        // Set latest available date for RSV view
        if (isRSV) {
          const dates = Object.keys(jsonData.forecasts || {}).sort();
          if (dates.length > 0) {
            setSelectedDates([dates[dates.length - 1]]);
            setActiveDate(dates[dates.length - 1]);
          }
        }
        
        setData(jsonData);
        
        // Extract models for flu view
        if (!isRSV) {
          const dates = Object.keys(jsonData.forecasts || {}).sort();
          const extractedModels = new Set();
          dates.forEach(date => {
            const forecastTypes = ['wk inc flu hosp', 'wk flu hosp rate change'];
            forecastTypes.forEach(type => {
              const typeForecast = jsonData.forecasts[date]?.[type] || {};
              Object.keys(typeForecast).forEach(model => extractedModels.add(model));
            });
          });
          const modelList = Array.from(extractedModels).sort((a, b) => a.localeCompare(b));
          setModels(modelList);
          setAvailableDates(dates);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [viewType, location]);


  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getTimeSeriesData = () => {
    if (!data || selectedDates.length === 0) return null;

    // Ground truth trace
    const groundTruthTrace = {
      x: data.ground_truth.dates,
      y: data.ground_truth.values,
      name: 'Observed',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#8884d8', width: 2 },
      marker: { size: 6 }
    };

    // Generate traces for each selected model and date combination
    const modelTraces = selectedModels.flatMap(model => 
      selectedDates.flatMap((date) => {
        const forecasts = data.forecasts[date] || {};
        const forecast = 
          forecasts['wk inc flu hosp']?.[model] || 
          forecasts['wk flu hosp rate change']?.[model];
      
        if (!forecast) return [];

        const forecastDates = [];
        const medianValues = [];
        const ci95Upper = [];
        const ci95Lower = [];
        const ci50Upper = [];
        const ci50Lower = [];

        // Process all horizons and sort by target date
        const sortedPredictions = Object.entries(forecast.predictions || {})
          .sort((a, b) => new Date(a[1].date) - new Date(b[1].date));
        
        sortedPredictions.forEach(([horizon, pred]) => {
          forecastDates.push(pred.date);
          
          if (forecast.type !== 'quantile') {
            return;
          }
          const quantiles = pred.quantiles || [];
          const values = pred.values || [];
          
          // Default to 0 if quantile not found
          const q95Lower = values[quantiles.indexOf(0.025)] || 0;
          const q50Lower = values[quantiles.indexOf(0.25)] || 0;
          const median = values[quantiles.indexOf(0.5)] || 0;
          const q50Upper = values[quantiles.indexOf(0.75)] || 0;
          const q95Upper = values[quantiles.indexOf(0.975)] || 0;
          
          ci95Lower.push(q95Lower);
          ci50Lower.push(q50Lower);
          medianValues.push(median);
          ci50Upper.push(q50Upper);
          ci95Upper.push(q95Upper);
        });

        const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];

        return [
          {
            x: [...forecastDates, ...forecastDates.slice().reverse()],
            y: [...ci95Upper, ...ci95Lower.slice().reverse()],
            fill: 'toself',
            fillcolor: `${modelColor}10`,
            line: { color: 'transparent' },
            showlegend: false,
            type: 'scatter',
            name: `${model} (${date}) 95% CI`
          },
          {
            x: [...forecastDates, ...forecastDates.slice().reverse()],
            y: [...ci50Upper, ...ci50Lower.slice().reverse()],
            fill: 'toself',
            fillcolor: `${modelColor}30`,
            line: { color: 'transparent' },
            showlegend: false,
            type: 'scatter',
            name: `${model} (${date}) 50% CI`
          },
          {
            x: forecastDates,
            y: medianValues,
            name: `${model} (${date})`,
            type: 'scatter',
            mode: 'lines+markers',
            line: { 
              color: modelColor,
              width: 2,
              dash: 'solid'
            },
            marker: { size: 6, color: modelColor },
            showlegend: true
          }
        ];
      })
    );

    return [groundTruthTrace, ...modelTraces];
  };

  const getRateChangeData = () => {
    if (!data || selectedDates.length === 0) return null;

    const categoryOrder = [
      'large_decrease',
      'decrease',
      'stable',
      'increase',
      'large_increase'
    ];

    // Only show rate change data for most recent selected date
    const lastSelectedDate = selectedDates.slice().sort().pop();
    
    return selectedModels.map(model => {
      const forecast = data.forecasts[lastSelectedDate]?.['wk flu hosp rate change']?.[model];
      if (!forecast) return null;

      const horizon0 = forecast.predictions['0'];
      if (!horizon0) return null;
      
      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];
    
      const orderedData = categoryOrder.map(cat => ({
        category: cat.replace('_', '<br>'),
        value: horizon0.probabilities[horizon0.categories.indexOf(cat)] * 100
      }));
      
      return {
        name: `${model} (${lastSelectedDate})`,
        y: orderedData.map(d => d.category),
        x: orderedData.map(d => d.value),
        type: 'bar',
        orientation: 'h',
        marker: { color: modelColor },
        showlegend: true,
        legendgroup: 'histogram',
        xaxis: 'x2',
        yaxis: 'y2'
      };
    }).filter(Boolean);
  };

  const toggleModelSelection = (model) => {
    setSelectedModels(prev => 
      prev.includes(model)
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-red-500">{error}</div>
    </div>;
  }

  const timeSeriesData = getTimeSeriesData();
  const rateChangeData = getRateChangeData();

  return (
    <div className="container mx-auto p-4">
      <div className="border rounded-lg shadow-sm bg-white">
        <div className="p-4 border-b flex justify-between items-center">
          <button 
            onClick={onBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back to State Selection</span>
          </button>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <img src="respilens-logo.svg" alt="RespiLens Logo" className="h-14 w-14" />
            <h2 className="text-2xl font-bold text-blue-600">
              RespiLens<sup className="text-red-500 text-xs">α</sup>
            </h2>
          </div>

          <InfoOverlay />
        </div>

        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {selectedDates.map((date, index) => (
              <div key={date} className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const sortedDates = selectedDates.slice().sort();
                    const dateIndex = availableDates.indexOf(date);
                    const currentPosition = sortedDates.indexOf(date);
                    const prevDate = availableDates[dateIndex - 1];
                    
                    // Check if moving left would cross another selected date
                    if (prevDate && (!sortedDates[currentPosition - 1] || new Date(prevDate) > new Date(sortedDates[currentPosition - 1]))) {
                      const newDates = [...selectedDates];
                      newDates[selectedDates.indexOf(date)] = prevDate;
                      setSelectedDates(newDates.sort());
                      setActiveDate(prevDate);
                    }
                  }}
                  disabled={
                    availableDates.indexOf(date) === 0 || // At start of available dates
                    (selectedDates.includes(availableDates[availableDates.indexOf(date) - 1])) // Would overlap with another date
                  }
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${date === activeDate ? 'text-blue-600' : ''}`}>
                    Week of {date}
                  </span>
                  <button
                    onClick={() => setSelectedDates(dates => dates.filter(d => d !== date))}
                    className="p-1 rounded-full hover:bg-gray-100"
                    disabled={selectedDates.length === 1}
                    style={{ opacity: selectedDates.length === 1 ? 0.5 : 1 }}
                  >
                    ×
                  </button>
                </div>

                <button 
                  onClick={() => {
                    const sortedDates = selectedDates.slice().sort();
                    const dateIndex = availableDates.indexOf(date);
                    const currentPosition = sortedDates.indexOf(date);
                    const nextDate = availableDates[dateIndex + 1];
                    
                    // Check if moving right would cross another selected date
                    if (nextDate && (!sortedDates[currentPosition + 1] || new Date(nextDate) < new Date(sortedDates[currentPosition + 1]))) {
                      const newDates = [...selectedDates];
                      newDates[selectedDates.indexOf(date)] = nextDate;
                      setSelectedDates(newDates.sort());
                      setActiveDate(nextDate);
                    }
                  }}
                  disabled={
                    availableDates.indexOf(date) === availableDates.length - 1 || // At end of available dates
                    (selectedDates.includes(availableDates[availableDates.indexOf(date) + 1])) // Would overlap with another date
                  }
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            {selectedDates.length < 5 && (
              <button
                onClick={() => {
                  if (selectedDates.length >= 5) return;
                  
                  const sortedSelectedDates = selectedDates.slice().sort();
                  const latestSelectedDate = sortedSelectedDates[sortedSelectedDates.length - 1];
                  const earliestSelectedDate = sortedSelectedDates[0];
                  const latestSelectedIdx = availableDates.indexOf(latestSelectedDate);
                  const earliestSelectedIdx = availableDates.indexOf(earliestSelectedDate);
                  
                  let dateToAdd;
                  
                  // If latest selected date is the last available date
                  if (latestSelectedIdx === availableDates.length - 1) {
                    // Try to add date before earliest selected date
                    if (earliestSelectedIdx > 0) {
                      dateToAdd = availableDates[earliestSelectedIdx - 1];
                    }
                  } else {
                    // Otherwise add next available date after latest selected
                    dateToAdd = availableDates[latestSelectedIdx + 1];
                  }

                  if (dateToAdd && !selectedDates.includes(dateToAdd)) {
                    setSelectedDates([...selectedDates, dateToAdd].sort());
                    setActiveDate(dateToAdd);
                  }
                }}
                disabled={selectedDates.length >= 5}
                className={`px-3 py-1 rounded border ${
                  selectedDates.length >= 5 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-100'
                }`}
              >
                + Add Date
              </button>
            )}
          </div>
        </div>

        <div className="p-4 w-full">
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-4 justify-between">
              <span className="text-xl text-center flex-grow">{data.metadata.location_name} Flu Forecasts</span>
              <ViewSelector />
            </h3>
            {viewType === 'rsv' ? (
              <RSVDefaultView location={location} />
            ) : (
              <FluView 
                data={data}
                selectedDates={selectedDates}
                selectedModels={selectedModels}
                viewType={viewType}
                windowSize={windowSize}
                getDefaultRange={getDefaultRange}
              />
            )}
            )}
          </div>
          
          <div className="mt-4 border-t pt-4">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setSelectedModels(models.filter(Boolean))}
                className="px-3 py-1 rounded text-sm border hover:bg-gray-100"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedModels([])}
                className="px-3 py-1 rounded text-sm border hover:bg-gray-100"
              >
                Select None
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {models.map(model => (
                <div
                  key={model}
                  onClick={() => toggleModelSelection(model)}
                  className={`px-3 py-1 rounded cursor-pointer text-sm transition-colors ${
                    selectedModels.includes(model)
                      ? 'text-white'
                      : 'border hover:bg-gray-100'
                  }`}
                  style={
                    selectedModels.includes(model) 
                      ? { backgroundColor: getModelColor(model, selectedModels) }
                      : undefined
                  }
                >
                  {model}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastViz;
