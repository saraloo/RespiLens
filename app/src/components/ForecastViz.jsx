import React, { useState, useEffect, useLayoutEffect } from 'react';
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
  const [currentDate, setCurrentDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

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

    const categoryOrder = [
      'large_decrease',
      'decrease',
      'stable',
      'increase',
      'large_increase'
    ];

    return selectedModels.map(model => {
      const forecast = data.forecasts[currentDate]['wk flu hosp rate change']?.[model];
      if (!forecast) return null;

      const horizon0 = forecast.predictions['0'];
      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];
    
      // Create ordered data
      const orderedData = categoryOrder.map(cat => ({
        category: cat.replace('_', '<br>'), // Split label at underscore
        value: horizon0.probabilities[horizon0.categories.indexOf(cat)] * 100
      }));
      
      return {
        name: model,
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


          <h2 className="text-2xl font-bold text-right">{data.metadata.location_name} Flu Forecasts</h2>
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
                  width: Math.min(1400, windowSize.width * 0.85),
                  height: Math.min(800, windowSize.height * 0.6),
                  autosize: true,
                  grid: {
                    columns: 1,
                    rows: 1,
                    pattern: 'independent',
                    subplots: [['xy'], ['x2y2']],
                    xgap: 0.15
                  },
                  showlegend: true,
                  hovermode: 'x unified',
                  margin: { l: 60, r: 30, t: 30, b: 80 },
                  xaxis: {
                    domain: [0, 0.7],
                    rangeslider: {},
                    rangeselector: {
                      buttons: [
                        {count: 1, label: '1m', step: 'month', stepmode: 'backward'},
                        {count: 6, label: '6m', step: 'month', stepmode: 'backward'},
                        {step: 'all', label: 'all'}
                      ]
                    },
                    range: [
                      new Date(currentDate).setDate(new Date(currentDate).getDate() - 56), // 8 weeks before
                      new Date(currentDate).setDate(new Date(currentDate).getDate() + 35)  // 5 weeks after
                    ]
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
                  }],
                  yaxis: {
                    title: 'Hospitalizations'
                  },
                  xaxis2: {
                    domain: [0.75, 1],
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
                  legend: {
                    orientation: 'h',
                    traceorder: 'normal',
                    x: 1,
                    y: 1.1,
                    xanchor: 'right',
                    yanchor: 'bottom'
                  }
                }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarPosition: 'top',
                  showSendToCloud: false,
                  plotlyServerURL: "",
                  toImageButtonOptions: {
                    format: 'png',
                    filename: 'forecast_plot'
                  }
                }}
                />
              </div>
            )}
          </div>
          
          <div className="mt-4 border-t pt-4">
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
