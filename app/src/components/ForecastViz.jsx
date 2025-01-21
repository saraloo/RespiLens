import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, Filter } from 'lucide-react';
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
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const [searchParams, setSearchParams] = useSearchParams();

  const getDefaultRange = useCallback(() => {
    if (selectedDates.length === 0) return undefined;
    const minDate = new Date(Math.min(...selectedDates));
    const maxDate = new Date(Math.max(...selectedDates));
    return [
      new Date(minDate.setDate(minDate.getDate() - 56)),
      new Date(maxDate.setDate(maxDate.getDate() + 35))
    ];
  }, [selectedDates]);

  // Update URL when selection changes
  useEffect(() => {
    if (selectedDates.length > 0 && selectedModels.length > 0) {
      setSearchParams({
        dates: selectedDates.join(','),
        models: selectedModels.join(','),
        location
      });
    }
  }, [selectedDates, selectedModels, location, setSearchParams]);

  // Read from URL on initial load
  useEffect(() => {
    const urlDates = searchParams.get('dates')?.split(',');
    const urlModels = searchParams.get('models')?.split(',');
    
    if (urlDates?.length > 0) {
      const validDates = urlDates.filter(date => availableDates.includes(date));
      setSelectedDates(validDates);
      setActiveDate(validDates[0]);
    }
    
    if (urlModels?.length > 0) {
      setSelectedModels(urlModels.filter(model => models.includes(model)));
    }
  }, [searchParams, availableDates, models]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`processed_data/${location}_flusight.json`);
        const jsonData = await response.json();
        setData(jsonData);
        
        const dates = Object.keys(jsonData.forecasts || {}).sort();
        
        // Comprehensive model extraction
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
        setSelectedDates([dates[dates.length - 1]]);
        setActiveDate(dates[dates.length - 1]);
        
        // Default model selection
        const defaultSelection = modelList.length > 0 
          ? (modelList.includes('FluSight-ensemble') 
              ? ['FluSight-ensemble'] 
              : [modelList[0]])
          : [];
        
        setSelectedModels(defaultSelection);
      } catch (err) {
        setError("Failed to load forecast data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

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
        const forecast = 
          data.forecasts[date]['wk inc flu hosp']?.[model] || 
          data.forecasts[date]['wk flu hosp rate change']?.[model];
      
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

    // Only show rate change data for active date
    return selectedModels.map(model => {
      const forecast = data.forecasts[activeDate]?.['wk flu hosp rate change']?.[model];
      if (!forecast) return null;

      const horizon0 = forecast.predictions['0'];
      if (!horizon0) return null;
      
      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];
    
      const orderedData = categoryOrder.map(cat => ({
        category: cat.replace('_', '<br>'),
        value: horizon0.probabilities[horizon0.categories.indexOf(cat)] * 100
      }));
      
      return {
        name: `${model} (${activeDate})`,
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
            <span>Back to State Selection</span>
          </button>


          <div className="flex items-center gap-2">
            <img src="/respiview-logo.svg" alt="FluView Logo" className="h-8 w-8" />
            <h2 className="text-2xl font-bold text-blue-600">{data.metadata.location_name} Flu Forecasts</h2>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {selectedDates.map((date, index) => (
              <div key={date} className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const idx = availableDates.indexOf(date);
                    if (idx > 0 && availableDates[idx - 1]) {  // Add null check
                      const newDates = [...selectedDates];
                      newDates[index] = availableDates[idx - 1];
                      setSelectedDates(newDates.filter(Boolean).sort());  // Add filter for null values
                      setActiveDate(availableDates[idx - 1]);
                    }
                  }}
                  disabled={availableDates.indexOf(date) === 0}
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
                    const idx = availableDates.indexOf(date);
                    if (idx < availableDates.length - 1) {
                      const newDates = [...selectedDates];
                      newDates[index] = availableDates[idx + 1];
                      setSelectedDates(newDates.sort());
                      setActiveDate(availableDates[idx + 1]);
                    }
                  }}
                  disabled={availableDates.indexOf(date) === availableDates.length - 1}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            {selectedDates.length < 3 && (
              <button
                onClick={() => {
                  const earliestCurrentDate = Math.min(...selectedDates);
                  const earliestDateIdx = availableDates.indexOf(earliestCurrentDate);
                  const targetIdx = Math.max(0, earliestDateIdx - 4); // Go back 4 weeks from earliest selected date
                  const dateToAdd = availableDates[targetIdx];
                  
                  if (dateToAdd && !selectedDates.includes(dateToAdd)) {
                    const newDates = [...selectedDates, dateToAdd].sort();
                    setSelectedDates(newDates);
                    setActiveDate(dateToAdd);
                  }
                }}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                + Add Date
              </button>
            )}
          </div>
        </div>

        <div className="p-4 w-full">
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4">Forecast Analysis</h3>
            {timeSeriesData && rateChangeData && (
              <div className="w-full" style={{ height: Math.min(800, windowSize.height * 0.6) }}>
                <Plot
                  style={{ width: '100%', height: '100%' }}
                  data={[
                  ...timeSeriesData,
                  ...rateChangeData.map(trace => ({
                    ...trace,
                    orientation: 'h',
                    xaxis: 'x2',
                    yaxis: 'y2'
                  }))
                ]}
                layout={{
                  width: Math.min(1200, windowSize.width * 0.8),
                  height: Math.min(800, windowSize.height * 0.6),
                  autosize: true,
                  grid: {
                    columns: 1,
                    rows: 1,
                    pattern: 'independent',
                    subplots: [['xy'], ['x2y2']],
                    xgap: 0.15
                  },
                  showlegend: false,
                  hovermode: 'x unified',
                  margin: { l: 60, r: 30, t: 30, b: 30 },
                  xaxis: {
                    domain: [0, 0.8],
                    rangeslider: {
                      range: getDefaultRange()
                    },
                    rangeselector: {
                      buttons: [
                        {count: 1, label: '1m', step: 'month', stepmode: 'backward'},
                        {count: 6, label: '6m', step: 'month', stepmode: 'backward'},
                        {step: 'all', label: 'all'}
                      ]
                    },
                    range: getDefaultRange()
                  },
                  shapes: selectedDates.map(date => ({
                    type: 'line',
                    x0: date,
                    x1: date,
                    y0: 0,
                    y1: 1,
                    yref: 'paper',
                    line: {
                      color: 'red',
                      width: 1,
                      dash: 'dash'
                    }
                  })),
                  yaxis: {
                    title: 'Hospitalizations'
                  },
                  xaxis2: {
                    domain: [0.85, 1],
                    showgrid: false
                  },
                  yaxis2: {
                    title: '',
                    showticklabels: true,
                    type: 'category',
                    side: 'right',
                    automargin: true,
                    tickfont: {
                      align: 'right'
                    }
                  },
                }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarPosition: 'left',
                  showSendToCloud: false,
                  plotlyServerURL: "",
                  toImageButtonOptions: {
                    format: 'png',
                    filename: 'forecast_plot'
                  },
                  modeBarButtonsToAdd: [{
                    name: 'Reset view',
                    click: function(gd) {
                      const range = getDefaultRange();
                      if (range) {
                        Plotly.relayout(gd, {
                          'xaxis.range': range,
                          'xaxis.rangeslider.range': range
                        });
                      }
                    }
                  }]
                }}
                />
              </div>
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
