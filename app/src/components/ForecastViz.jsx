import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import Plot from 'react-plotly.js';

const ForecastViz = ({ location, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('FluSight-ensemble');
  const [currentDate, setCurrentDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);
  const [view, setView] = useState('zoomed');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/processed_data/${location}.json`);
        const jsonData = await response.json();
        setData(jsonData);
        
        const dates = Array.from(new Set(
          jsonData.forecasts['wk inc flu hosp']
            .map(f => f.reference_date)
        )).sort();
        
        const modelList = Array.from(new Set(
          jsonData.forecasts['wk inc flu hosp']
            .map(f => f.model)
        ));
        
        setAvailableDates(dates);
        setCurrentDate(dates[dates.length - 1]);
        setModels(modelList);
        
        if (modelList.includes('FluSight-ensemble')) {
          setSelectedModel('FluSight-ensemble');
        } else {
          setSelectedModel(modelList[0]);
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
    
    const refDateIndex = data.ground_truth.dates.indexOf(currentDate);
    if (refDateIndex === -1) return null;

    // Calculate date ranges
    let startIndex = fullTimeline ? 0 : Math.max(0, refDateIndex - 8);
    const endIndex = fullTimeline 
      ? data.ground_truth.dates.length - 1 
      : Math.min(data.ground_truth.dates.length - 1, refDateIndex + 5);

    // Process ground truth data with strict continuity checking
    const groundTruthSegments = [];
    let currentSegment = { x: [], y: [] };
    
    for (let i = startIndex; i <= endIndex; i++) {
      const value = data.ground_truth.values[i];
      const currentDate = new Date(data.ground_truth.dates[i]);
      
      // Check if we should start a new segment
      const shouldStartNewSegment = 
        // If current value is missing
        value === null || value === undefined ||
        // Or if there's a gap in dates (more than 7 days)
        (currentSegment.x.length > 0 && 
         (currentDate - new Date(currentSegment.x[currentSegment.x.length - 1])) > 7 * 24 * 60 * 60 * 1000);
      
      if (shouldStartNewSegment) {
        if (currentSegment.x.length > 0) {
          groundTruthSegments.push({...currentSegment});
          currentSegment = { x: [], y: [] };
        }
      } else {
        currentSegment.x.push(data.ground_truth.dates[i]);
        currentSegment.y.push(value);
      }
    }
    
    if (currentSegment.x.length > 0) {
      groundTruthSegments.push(currentSegment);
    }
    
    // Sort dates within each segment to ensure proper line connection
    groundTruthSegments.forEach(segment => {
      const paired = segment.x.map((x, i) => ({x, y: segment.y[i]}));
      paired.sort((a, b) => new Date(a.x) - new Date(b.x));
      segment.x = paired.map(p => p.x);
      segment.y = paired.map(p => p.y);
    });

    const groundTruthTraces = groundTruthSegments.map((segment, idx) => ({
      x: segment.x,
      y: segment.y,
      name: idx === 0 ? 'Observed' : 'Observed_cont',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#8884d8', width: 2 },
      marker: { size: 6 },
      showlegend: idx === 0
    }));

    // Get forecast data
    const forecast = data.forecasts['wk inc flu hosp']
      .find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (!forecast) {
      return groundTruthTraces;
    }

    // Process forecast data
    const forecastDates = [];
    const medianValues = [];
    const ci95Upper = [];
    const ci95Lower = [];
    const ci50Upper = [];
    const ci50Lower = [];

    // Add current date forecast
    const currentDateValues = forecast.data.horizons['0'].values;
    forecastDates.push(currentDate);
    medianValues.push(currentDateValues[2]); // median
    ci95Lower.push(currentDateValues[0]); // 2.5%
    ci95Upper.push(currentDateValues[4]); // 97.5%
    ci50Lower.push(currentDateValues[1]); // 25%
    ci50Upper.push(currentDateValues[3]); // 75%

    // Add future forecasts
    Object.entries(forecast.data.horizons)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([horizon, horizonData]) => {
        if (parseInt(horizon) > 0) {
          forecastDates.push(horizonData.date);
          medianValues.push(horizonData.values[2]);
          ci95Lower.push(horizonData.values[0]);
          ci95Upper.push(horizonData.values[4]);
          ci50Lower.push(horizonData.values[1]);
          ci50Upper.push(horizonData.values[3]);
        }
      });

    // Create confidence interval traces
    const ci95 = {
      x: [...forecastDates, ...forecastDates.slice().reverse()],
      y: [...ci95Upper, ...ci95Lower.slice().reverse()],
      fill: 'toself',
      fillcolor: 'rgba(130, 202, 157, 0.2)',
      line: { color: 'transparent' },
      name: '95% CI',
      showlegend: true,
      type: 'scatter'
    };

    const ci50 = {
      x: [...forecastDates, ...forecastDates.slice().reverse()],
      y: [...ci50Upper, ...ci50Lower.slice().reverse()],
      fill: 'toself',
      fillcolor: 'rgba(130, 202, 157, 0.4)',
      line: { color: 'transparent' },
      name: '50% CI',
      showlegend: true,
      type: 'scatter'
    };

    const medianForecast = {
      x: forecastDates,
      y: medianValues,
      name: 'Forecast Median',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#82ca9d', width: 2, dash: 'dash' },
      marker: { size: 6 }
    };

    return [ci95, ci50, ...groundTruthTraces, medianForecast];
  };

  const getRateChangeData = () => {
    if (!data || !currentDate) return null;

    const forecast = data.forecasts['wk flu hosp rate change']
      ?.find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (!forecast) return null;

    const horizon0 = forecast.data.horizons['0'];
    
    return [{
      x: horizon0.categories,
      y: horizon0.values.map(v => v * 100),
      type: 'bar',
      marker: {
        color: 'rgba(75, 192, 192, 0.6)',
        line: {
          color: 'rgba(75, 192, 192, 1)',
          width: 1
        }
      }
    }];
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

  const timeSeriesData = getTimeSeriesData(view === 'full');
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
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="border rounded px-3 py-1"
            >
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="border rounded px-3 py-1"
            >
              <option value="zoomed">Zoomed View</option>
              <option value="full">Full Timeline</option>
            </select>
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

        <div className="grid grid-cols-12 gap-4 p-4">
          {/* Left column: Overview timeline */}
          <div className="col-span-3">
            <h3 className="text-lg font-semibold mb-4">Full Timeline</h3>
            {timeSeriesData && (
              <Plot
                data={timeSeriesData}
                layout={{
                  height: 200,
                  showlegend: false,
                  hovermode: 'x unified',
                  margin: { l: 40, r: 10, t: 10, b: 30 },
                  xaxis: {
                    title: '',
                    tickangle: -45,
                    tickformat: '%Y-%m'
                  },
                  yaxis: {
                    title: 'Hospitalizations',
                    zeroline: true
                  }
                }}
                config={{
                  responsive: true,
                  displayModeBar: false
                }}
              />
            )}
          </div>

          {/* Middle column: Rate change forecast */}
          <div className="col-span-3">
            <h3 className="text-lg font-semibold mb-4">Rate Change</h3>
            {rateChangeData && (
              <Plot
                data={[{
                  ...rateChangeData[0],
                  orientation: 'h',
                  x: rateChangeData[0].y,
                  y: ['large_decrease', 'decrease', 'stable', 'increase', 'large_increase'],
                  type: 'bar'
                }]}
                layout={{
                  height: 200,
                  showlegend: false,
                  margin: { l: 120, r: 10, t: 10, b: 30 },
                  xaxis: {
                    title: 'Probability (%)',
                    range: [0, 100]
                  },
                  yaxis: {
                    title: '',
                    autorange: 'reversed'
                  },
                  bargap: 0.2
                }}
                config={{
                  responsive: true,
                  displayModeBar: false
                }}
              />
            )}
          </div>

          {/* Right column: Detailed forecast */}
          <div className="col-span-6">
            <h3 className="text-lg font-semibold mb-4">Detailed Forecast</h3>
            {timeSeriesData && (
              <Plot
                data={timeSeriesData}
                layout={{
                  height: 400,
                  showlegend: true,
                  hovermode: 'x unified',
                  margin: { l: 50, r: 20, t: 10, b: 40 },
                  xaxis: {
                    title: 'Date',
                    tickangle: -45,
                    range: [
                      new Date(currentDate).setDate(new Date(currentDate).getDate() - 56), // 8 weeks before
                      new Date(currentDate).setDate(new Date(currentDate).getDate() + 35)  // 5 weeks after
                    ]
                  },
                  yaxis: {
                    title: 'Hospitalizations',
                    zeroline: true
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