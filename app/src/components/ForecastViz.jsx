import React, { useState, useEffect } from 'react';
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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const getTimeSeriesData = (showFullTimeline = false) => {
    if (!data || !currentDate) return null;
    const refDateIndex = data.ground_truth.dates.indexOf(currentDate);
    if (refDateIndex === -1) return null;
    
    const historyStartIndex = showFullTimeline ? 0 : Math.max(0, refDateIndex - 8);
    const dates = [];
    const observed = [];
    const forecast = [];
    const ci95Lower = [];
    const ci95Upper = [];
    const ci75Lower = [];
    const ci75Upper = [];
    const ci50Lower = [];
    const ci50Upper = [];
    
    // Historical data
    for (let i = historyStartIndex; i <= refDateIndex; i++) {
      dates.push(formatDate(data.ground_truth.dates[i]));
      observed.push(data.ground_truth.values[i]);
      forecast.push(null);
      ci95Lower.push(null);
      ci95Upper.push(null);
      ci75Lower.push(null);
      ci75Upper.push(null);
      ci50Lower.push(null);
      ci50Upper.push(null);
    }

    // Forecast data
    const forecastData = data.forecasts['wk inc flu hosp']
      .find(f => f.reference_date === currentDate && f.model === selectedModel);

    if (forecastData) {
      // Current date forecast
      const currentDateValues = forecastData.data.horizons['0'].values;
      forecast[forecast.length - 1] = currentDateValues[11]; // median
      ci95Lower[ci95Lower.length - 1] = currentDateValues[0]; // 0.025 quantile
      ci95Upper[ci95Upper.length - 1] = currentDateValues[22]; // 0.975 quantile
      ci75Lower[ci75Lower.length - 1] = currentDateValues[3]; // 0.125 quantile
      ci75Upper[ci75Upper.length - 1] = currentDateValues[19]; // 0.875 quantile
      ci50Lower[ci50Lower.length - 1] = currentDateValues[5]; // 0.25 quantile
      ci50Upper[ci50Upper.length - 1] = currentDateValues[17]; // 0.75 quantile

      // Future forecasts
      Object.entries(forecastData.data.horizons)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([horizon, horizonData]) => {
          if (parseInt(horizon) > 0) {
            dates.push(formatDate(horizonData.date));
            observed.push(null);
            forecast.push(horizonData.values[11]); // median
            ci95Lower.push(horizonData.values[0]); // 0.025 quantile
            ci95Upper.push(horizonData.values[22]); // 0.975 quantile
            ci75Lower.push(horizonData.values[3]); // 0.125 quantile
            ci75Upper.push(horizonData.values[19]); // 0.875 quantile
            ci50Lower.push(horizonData.values[5]); // 0.25 quantile
            ci50Upper.push(horizonData.values[17]); // 0.75 quantile
          }
        });
    }

    return {
      labels: dates,
      datasets: [
        {
          label: '95% CI',
          data: ci95Upper,
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: 0,
          backgroundColor: 'rgba(211, 211, 211, 0.2)',
          fill: {
            target: {
              value: ci95Lower
            },
            above: 'rgba(211, 211, 211, 0.2)'
          }
        },
        {
          label: '75% CI',
          data: ci75Upper,
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: 0,
          backgroundColor: 'rgba(211, 211, 211, 0.3)',
          fill: {
            target: {
              value: ci75Lower
            },
            above: 'rgba(211, 211, 211, 0.3)'
          }
        },
        {
          label: '50% CI',
          data: ci50Upper,
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: 0,
          backgroundColor: 'rgba(211, 211, 211, 0.4)',
          fill: {
            target: {
              value: ci50Lower
            },
            above: 'rgba(211, 211, 211, 0.4)'
          }
        },
        {
          label: 'Median Forecast',
          data: forecast,
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 3,
          pointBackgroundColor: 'rgba(76, 175, 80, 1)',
          fill: false,
        },
        {
          label: 'Observed',
          data: observed,
          borderColor: 'rgba(63, 81, 181, 1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(63, 81, 181, 1)',
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

  const chartOptions = (showFullTimeline = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          filter: (item) => !item.text.includes('Area')
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index'
      },
      title: {
        display: true,
        text: showFullTimeline ? 'Full Timeline' : 'Recent Timeline with Forecast'
      }
    }
  });

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

  const timeSeriesData = getTimeSeriesData(false);
  const fullTimelineData = getTimeSeriesData(true);
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
            <span className="font-medium">Week of {formatDate(currentDate)}</span>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Timeline</h3>
            <div className="h-96">
              {timeSeriesData && (
                <Line
                  data={timeSeriesData}
                  options={chartOptions(false)}
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Full Timeline</h3>
            <div className="h-96">
              {fullTimelineData && (
                <Line
                  data={fullTimelineData}
                  options={chartOptions(true)}
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
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
