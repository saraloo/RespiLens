import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
    
    const dates = [];
    const observed = [];
    const forecast = [];
    const ci95Lower = [];
    const ci95Upper = [];
    const ci75Lower = [];
    const ci75Upper = [];
    const ci50Lower = [];
    const ci50Upper = [];
    
    // Always show full ground truth data
    data.ground_truth.dates.forEach((dateStr, i) => {
      const date = new Date(dateStr);
      dates.push(`${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`);
      observed.push(data.ground_truth.values[i]);
      forecast.push(null);
      ci95Lower.push(null);
      ci95Upper.push(null);
      ci75Lower.push(null);
      ci75Upper.push(null);
      ci50Lower.push(null);
      ci50Upper.push(null);
    });

    // Forecast data
    const forecastData = data.forecasts['wk inc flu hosp']
      .find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (forecastData) {
      // Find index of current date in ground truth
      const refDateIndex = data.ground_truth.dates.indexOf(currentDate);
      if (refDateIndex !== -1) {
        // Current date forecast
        const currentDateValues = forecastData.data.horizons['0'].values;
        forecast[refDateIndex] = currentDateValues[3];
        ci95Lower[refDateIndex] = currentDateValues[0];
        ci95Upper[refDateIndex] = currentDateValues[6];
        ci75Lower[refDateIndex] = currentDateValues[1];
        ci75Upper[refDateIndex] = currentDateValues[5];
        ci50Lower[refDateIndex] = currentDateValues[2];
        ci50Upper[refDateIndex] = currentDateValues[4];

      // Future forecasts
      Object.entries(forecastData.data.horizons)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([horizon, horizonData]) => {
          if (parseInt(horizon) > 0) {
            const date = new Date(horizonData.date);
            dates.push(`${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`);
            observed.push(null);
            forecast.push(horizonData.values[3]);
            ci95Lower.push(horizonData.values[0]);
            ci95Upper.push(horizonData.values[6]);
            ci75Lower.push(horizonData.values[1]);
            ci75Upper.push(horizonData.values[5]);
            ci50Lower.push(horizonData.values[2]);
            ci50Upper.push(horizonData.values[4]);
          }
        });
    }

    return {
      labels: dates,
      datasets: [
        {
          label: '95% CI',
          data: ci95Upper,
          fill: '+1',
          backgroundColor: 'rgba(130, 202, 157, 0.05)',
          borderWidth: 0,
        },
        {
          label: '95% CI Lower',
          data: ci95Lower,
          fill: false,
          borderWidth: 0,
        },
        {
          label: '75% CI',
          data: ci75Upper,
          fill: '+1',
          backgroundColor: 'rgba(130, 202, 157, 0.1)',
          borderWidth: 0,
        },
        {
          label: '75% CI Lower',
          data: ci75Lower,
          fill: false,
          borderWidth: 0,
        },
        {
          label: '50% CI',
          data: ci50Upper,
          fill: '+1',
          backgroundColor: 'rgba(130, 202, 157, 0.2)',
          borderWidth: 0,
        },
        {
          label: '50% CI Lower',
          data: ci50Lower,
          fill: false,
          borderWidth: 0,
        },
        {
          label: 'Observed',
          data: observed,
          borderColor: '#8884d8',
          borderWidth: 2,
          pointRadius: 4,
          fill: false,
        },
        {
          label: 'Forecast',
          data: forecast,
          borderColor: '#82ca9d',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          fill: false,
        }
      ]
    };
  };

  const getRateChangeData = () => {
    if (!data || !currentDate) return null;

    const forecast = data.forecasts['wk flu hosp rate change']
      ?.find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (!forecast) return null;

    const horizon0 = forecast.data.horizons['0'];
    
    return {
      labels: horizon0.categories,
      datasets: [{
        label: 'Probability',
        data: horizon0.values,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    };
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
        <div className="text-red-500">{error}</div>
      </div>
    );
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Hospitalization Forecast (Zoomed)</h3>
            <div className="h-96">
              {getTimeSeriesData() && (
                <Line
                  data={getTimeSeriesData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      intersect: false,
                      mode: 'index'
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top'
                      },
                      tooltip: {
                        enabled: true,
                        mode: 'index'
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Full Timeline</h3>
            <div className="h-96">
              {getTimeSeriesData(true) && (
                <Line
                  data={getTimeSeriesData(true)}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      intersect: false,
                      mode: 'index'
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    },
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        enabled: true,
                        mode: 'index'
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Rate Change Forecast</h3>
            <div className="h-96">
              {rateChangeData && (
                <Bar
                  data={rateChangeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                          callback: (value) => `${(value * 100).toFixed(0)}%`
                        }
                      }
                    },
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${(context.raw * 100).toFixed(1)}%`
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastViz;
