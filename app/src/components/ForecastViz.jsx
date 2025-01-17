import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, BarChart, Bar 
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <div className="bg-white p-3 border rounded shadow">
        <p className="font-bold mb-2">{formattedDate}</p>
        {payload
          .filter(entry => entry.value !== null)
          .map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
      </div>
    );
  }
  return null;
};

const ForecastViz = ({ location, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('FluSight-ensemble');
  const [currentDate, setCurrentDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/processed_data/${location}.json`);
        const jsonData = await response.json();
        setData(jsonData);
        
        // Get unique dates and models
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
        
        // Set default model to FluSight-ensemble if available
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

  // Process data for time series chart
  const getTimeSeriesData = () => {
    if (!data || !currentDate) return [];

    // Find the forecast reference date's index in ground truth
    const refDateIndex = data.ground_truth.dates.indexOf(currentDate);
    if (refDateIndex === -1) return [];
    
    // Show 8 weeks of history
    const historyStartIndex = Math.max(0, refDateIndex - 8);
    
    // Initialize result array with ground truth data
    const result = [];
    
    // Add historical data
    for (let i = historyStartIndex; i <= refDateIndex; i++) {
      result.push({
        date: data.ground_truth.dates[i],
        observed: data.ground_truth.values[i],
        // Add null values for forecast intervals to maintain continuous line
        forecast: null,
        ci95_lower: null,
        ci95_upper: null,
        ci50_lower: null,
        ci50_upper: null
      });
    }

    // Get forecast data for selected date and model
    const forecast = data.forecasts['wk inc flu hosp']
      .find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (forecast) {
      // Add the reference point (overlapping point)
      if (forecast.data.horizons['0']) {
        result.push({
          date: currentDate,
          observed: data.ground_truth.values[refDateIndex],
          forecast: forecast.data.horizons['0'].values[2], // median
          ci95_lower: forecast.data.horizons['0'].values[0],
          ci95_upper: forecast.data.horizons['0'].values[4],
          ci50_lower: forecast.data.horizons['0'].values[1],
          ci50_upper: forecast.data.horizons['0'].values[3]
        });
      }

      // Add forecast points
      Object.entries(forecast.data.horizons)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([horizon, horizonData]) => {
          if (parseInt(horizon) > 0) { // Skip horizon 0 as it's already added
            result.push({
              date: horizonData.date,
              observed: null, // No observations for future dates
              forecast: horizonData.values[2], // median
              ci95_lower: horizonData.values[0],
              ci95_upper: horizonData.values[4],
              ci50_lower: horizonData.values[1],
              ci50_upper: horizonData.values[3]
            });
          }
        });
    }

    return result;
  };

  // Process data for rate change chart
  const getRateChangeData = () => {
    if (!data || !currentDate) return [];

    const forecast = data.forecasts['wk flu hosp rate change']
      ?.find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (!forecast) return [];

    const horizon0 = forecast.data.horizons['0'];
    return horizon0.categories.map((category, i) => ({
      category,
      probability: horizon0.values[i]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

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

      <div className="border rounded-lg shadow-sm bg-white mb-8">
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

        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Hospitalization Forecast</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={getTimeSeriesData()} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* 95% Confidence Interval */}
                <Area
                  type="monotone"
                  dataKey="ci95_upper"
                  stroke="none"
                  fill="#82ca9d"
                  fillOpacity={0.1}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="ci95_lower"
                  stroke="none"
                  fill="#82ca9d"
                  fillOpacity={0.1}
                  isAnimationActive={false}
                />
                
                {/* 50% Confidence Interval */}
                <Area
                  type="monotone"
                  dataKey="ci50_upper"
                  stroke="none"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="ci50_lower"
                  stroke="none"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
                
                {/* Observed Data */}
                <Line
                  type="monotone"
                  dataKey="observed"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={true}
                  connectNulls={true}
                  isAnimationActive={false}
                  name="Observed"
                />
                
                {/* Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={true}
                  connectNulls={true}
                  isAnimationActive={false}
                  name="Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border-t">
          <h3 className="text-lg font-semibold mb-4">Rate Change Forecast</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={getRateChangeData()} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis 
                  domain={[0, 1]} 
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} 
                />
                <Tooltip 
                  formatter={(value) => `${(value * 100).toFixed(1)}%`} 
                />
                <Legend />
                <Bar 
                  dataKey="probability" 
                  fill="#8884d8" 
                  name="Probability" 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastViz;