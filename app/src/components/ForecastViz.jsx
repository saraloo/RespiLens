import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import Plot from 'react-plotly.js';

const ForecastViz = ({ location, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModels, setSelectedModels] = useState(['FluSight-ensemble']);
  const [currentDate, setCurrentDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/processed_data/${location}.json`);
        const jsonData = await response.json();
        setData(jsonData);
        
        const dates = Object.keys(jsonData.forecasts).sort();
        const modelList = Object.keys(
          jsonData.forecasts[dates[0]]['wk inc flu hosp'] || {}
        );
        
        setAvailableDates(dates);
        setCurrentDate(dates[dates.length - 1]);
        setModels(modelList);
        
        if (modelList.includes('FluSight-ensemble')) {
          setSelectedModels(['FluSight-ensemble']);
        } else {
          setSelectedModels([modelList[0]]);
        }
      } catch (err) {
        setError("Failed to load forecast data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

  const getTimeSeriesData = (fullTimeline = false) => {
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
      const forecast = data.forecasts[currentDate]['wk inc flu hosp'][model];
      if (!forecast) return [];

      const forecastDates = [];
      const medianValues = [];
      const ci95Upper = [];
      const ci95Lower = [];
      const ci50Upper = [];
      const ci50Lower = [];

      // Process all horizons
      Object.entries(forecast.predictions).forEach(([horizon, pred]) => {
        forecastDates.push(pred.date);
        const values = pred.values;
        ci95Lower.push(values[0]); // 2.5%
        ci50Lower.push(values[1]); // 25%
        medianValues.push(values[2]); // 50%
        ci50Upper.push(values[3]); // 75%
        ci95Upper.push(values[4]); // 97.5%
      });

      return [
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci95Upper, ...ci95Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `rgba(130, 202, 157, ${0.1 + selectedModels.indexOf(model) * 0.1})`,
          line: { color: 'transparent' },
          name: `${model} 95% CI`,
          showlegend: true,
          type: 'scatter'
        },
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci50Upper, ...ci50Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `rgba(130, 202, 157, ${0.2 + selectedModels.indexOf(model) * 0.1})`,
          line: { color: 'transparent' },
          name: `${model} 50% CI`,
          showlegend: true,
          type: 'scatter'
        },
        {
          x: forecastDates,
          y: medianValues,
          name: `${model} Median`,
          type: 'scatter',
          mode: 'lines+markers',
          line: { 
            color: '#82ca9d',
            width: 2,
            dash: 'dash'
          },
          marker: { size: 6 }
        }
      ];
    });

    return [groundTruthTrace, ...modelTraces];
  };

  const getRateChangeData = () => {
    if (!data || !currentDate) return null;

    return selectedModels.map(model => {
      const forecast = data.forecasts[currentDate]['wk flu hosp rate change'][model];
      if (!forecast) return null;

      const horizon0 = forecast.predictions['0'];
      return {
        name: model,
        x: horizon0.probabilities.map(v => v * 100),
        y: horizon0.categories,
        type: 'bar',
        orientation: 'h',
        marker: {
          color: `rgba(75, 192, 192, ${0.3 + selectedModels.indexOf(model) * 0.2})`,
          line: {
            color: 'rgba(75, 192, 192, 1)',
            width: 1
          }
        }
      };
    }).filter(Boolean);
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

        <div className="p-4 border-b flex justify-between items-center">
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
            <div className="flex flex-wrap gap-2">
              {models.map(model => (
                <button
                  key={model}
                  onClick={() => {
                    setSelectedModels(prev => 
                      prev.includes(model)
                        ? prev.filter(m => m !== model)
                        : [...prev, model]
                    );
                  }}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedModels.includes(model)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
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

        <div className="flex flex-col gap-4 p-4">
          {/* Full Timeline */}
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4">Full Timeline</h3>
            {timeSeriesData && (
              <Plot
                data={timeSeriesData}
                layout={{
                  height: 250,
                  showlegend: true,
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
                  displayModeBar: false
                }}
              />
            )}
          </div>

          {/* Zoomed Timeline */}
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4">Detailed Forecast</h3>
            {timeSeriesData && (
              <Plot
                data={timeSeriesData}
                layout={{
                  height: 300,
                  showlegend: true,
                  hovermode: 'x unified',
                  margin: { l: 50, r: 20, t: 10, b: 40 },
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
                  displayModeBar: false
                }}
              />
            )}
          </div>

          {/* Rate Change */}
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4">Rate Change Forecast</h3>
            {rateChangeData && (
              <Plot
                data={rateChangeData}
                layout={{
                  height: 250,
                  showlegend: true,
                  barmode: 'stack',
                  margin: { l: 150, r: 20, t: 10, b: 40 },
                  xaxis: {
                    title: 'Probability (%)',
                    range: [0, 100]
                  },
                  yaxis: {
                    title: '',
                    autorange: 'reversed'
                  },
                  legend: {
                    orientation: 'h',
                    yanchor: 'bottom',
                    y: -0.3,
                    xanchor: 'center',
                    x: 0.5
                  }
                }}
                config={{
                  responsive: true,
                  displayModeBar: false
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