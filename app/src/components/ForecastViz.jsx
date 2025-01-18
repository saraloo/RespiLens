import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, Filter } from 'lucide-react';
import Plot from 'react-plotly.js';

// Color palette for model visualization
const MODEL_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const ForecastViz = ({ location, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModels, setSelectedModels] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);
  const [isModelFilterOpen, setIsModelFilterOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/processed_data/${location}.json`);
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
        setCurrentDate(dates[dates.length - 1]);
        
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

  const getTimeSeriesData = () => {
    if (!data || !currentDate) return null;

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

    // Generate traces for each selected model
    const modelTraces = selectedModels.flatMap(model => {
      // Try both forecast types
      const forecast = 
        data.forecasts[currentDate]['wk inc flu hosp']?.[model] || 
        data.forecasts[currentDate]['wk flu hosp rate change']?.[model];
      
      if (!forecast) return [];

      const forecastDates = [];
      const medianValues = [];
      const ci95Upper = [];
      const ci95Lower = [];
      const ci50Upper = [];
      const ci50Lower = [];

      // Process all horizons
      Object.entries(forecast.predictions || {}).forEach(([horizon, pred]) => {
        forecastDates.push(pred.date);
        const values = pred.values || [0, 0, 0, 0, 0];
        ci95Lower.push(values[0]); // 2.5%
        ci50Lower.push(values[1]); // 25%
        medianValues.push(values[2]); // 50%
        ci50Upper.push(values[3]); // 75%
        ci95Upper.push(values[4]); // 97.5%
      });

      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];

      return [
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci95Upper, ...ci95Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `${modelColor}20`, // 20% opacity
          line: { color: 'transparent' },
          showlegend: false,
          type: 'scatter'
        },
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci50Upper, ...ci50Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `${modelColor}40`, // 40% opacity
          line: { color: 'transparent' },
          showlegend: false,
          type: 'scatter'
        },
        {
          x: forecastDates,
          y: medianValues,
          name: model,
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
    });

    return [groundTruthTrace, ...modelTraces];
  };

  const getRateChangeData = () => {
    if (!data || !currentDate) return null;

    return selectedModels.map(model => {
      const forecast = data.forecasts[currentDate]['wk flu hosp rate change']?.[model];
      if (!forecast) return null;

      const horizon0 = forecast.predictions['0'];
      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];
      
      return {
        name: model,
        x: horizon0.probabilities.map(v => v * 100),
        y: horizon0.categories,
        type: 'bar',
        orientation: 'h',
        marker: {
          color: modelColor
        }
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
      <div className="flex items-center mb-6">
        <button 
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to State Selection</span>
        </button>
      </div>

      <div className="border rounded-lg shadow-sm bg-white">
        <div className="p-4 border-b">
          <h2 className="text-2xl font-bold">{data.metadata.location_name} Flu Forecasts</h2>
        </div>

        <div className="p-4 border-b flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => {
                const idx = availableDates.indexOf(currentDate);
                if (idx > 0) setCurrentDate(availableDates[idx - 1]);
              }}
              disabled={availableDates.indexOf(currentDate) === 0}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <span className="font-medium">Week of {currentDate}</span>
            </div>

            <button 
              onClick={() => {
                const idx = availableDates.indexOf(currentDate);
                if (idx < availableDates.length - 1) setCurrentDate(availableDates[idx + 1]);
              }}
              disabled={availableDates.indexOf(currentDate) === availableDates.length - 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Model Selector */}
          <div className="relative">
            <div className="flex justify-center mb-2">
              <button 
                onClick={() => setIsModelFilterOpen(!isModelFilterOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Select Models ({selectedModels.length})</span>
              </button>
            </div>

            {isModelFilterOpen && (
              <div className="absolute z-10 w-full bg-white border rounded shadow-lg p-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {models.map(model => (
                    <label 
                      key={model} 
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input 
                        type="checkbox"
                        checked={selectedModels.includes(model)}
                        onChange={() => toggleModelSelection(model)}
                        className="form-checkbox h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm">{model}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 p-4 w-full">
          {/* Top Row - Detailed and Categorical Forecasts */}
          <div className="flex flex-row gap-8 w-full">
            {/* Detailed Forecast */}
            <div className="w-2/3">
              <h3 className="text-lg font-semibold mb-4">Detailed Forecast</h3>
              {timeSeriesData && (
                <Plot
                  data={timeSeriesData}
                  layout={{
                    height: 500,
                    width: '100%',
                    showlegend: true,
                    hovermode: 'x unified',
                    margin: { l: 50, r: 20, t: 10, b: 40 },
                    legend: {
                      x: 1.1,
                      xanchor: 'left',
                      y: 1,
                      yanchor: 'top'
                    },
                    xaxis: {
                      title: 'Date',
                      tickangle: -45,
                      range: [
                        new Date(currentDate).setDate(new Date(currentDate).getDate() - 56),
                        new Date(currentDate).setDate(new Date(currentDate).getDate() + 35)
                      ]
                    },
                    yaxis: {
                      title: 'Hospitalizations',
                      zeroline: true
                    },
                    shapes: [{
                      type: 'line',
                      x0: currentDate,
                      x1: currentDate,
                      y0: 0,
                      y1: 1,
                      yref: 'paper',
                      line: {
                        color: 'red',
                        width: 1,
                        dash: 'dash'
                      }
                    }]
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: false,
                    autosize: true
                  }}
                />
              )}
            </div>

            {/* Rate Change */}
            <div className="w-1/3">
              <h3 className="text-lg font-semibold mb-4">Rate Change Forecast</h3>
              {rateChangeData && (
                <Plot
                  data={rateChangeData}
                  layout={{
                    height: 500,
                    width: '100%',
                    showlegend: true,
                    barmode: 'stack',
                    margin: { l: 150, r: 20, t: 10, b: 40 },
                    legend: {
                      orientation: 'h',
                      yanchor: 'bottom',
                      y: -0.3,
                      xanchor: 'center',
                      x: 0.5
                    },
                    xaxis: {
                      title: 'Probability (%)',
                      range: [0, 100]
                    },
                    yaxis: {
                      title: '',
                      autorange: 'reversed'
                    }
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: false,
                    autosize: true
                  }}
                />
              )}
            </div>
          </div>

          {/* Full Timeline - Centered */}
          <div className="w-4/5 mx-auto">
            <h3 className="text-lg font-semibold mb-4">Full Timeline</h3>
            {timeSeriesData && (
              <Plot
                data={timeSeriesData}
                layout={{
                  height: 300,
                  width: '100%',
                  showlegend: false,
                  hovermode: 'x unified',
                  margin: { l: 50, r: 20, t: 10, b: 40 },
                  xaxis: {
                    title: '',
                    tickangle: -45,
                    range: [
                      data.ground_truth.dates[0],
                      data.ground_truth.dates[data.ground_truth.dates.length - 1]
                    ]
                  },
                  yaxis: {
                    title: 'Hospitalizations',
                    zeroline: true
                  },
                  shapes: [{
                    type: 'line',
                    x0: currentDate,
                    x1: currentDate,
                    y0: 0,
                    y1: 1,
                    yref: 'paper',
                    line: {
                      color: 'red',
                      width: 1,
                      dash: 'dash'
                    }
                  }]
                }}
                config={{
                  responsive: true,
                  displayModeBar: false,
                  autosize: true
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastViz;
