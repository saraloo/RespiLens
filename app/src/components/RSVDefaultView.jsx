import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import ModelSelector from './ModelSelector';

const MODEL_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const RSVDefaultView = ({ location, ageGroups = ["0-0.99", "1-4", "5-64", "65-130"] }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`./processed_data/rsv/${location}_rsv.json`);
        console.log('RSV fetch response:', response);
        if (!response.ok) {
          throw new Error(`No RSV data available for ${location} (status ${response.status})`);
        }
        const jsonData = await response.json();
        console.log('RSV data structure:', {
          metadataPresent: !!jsonData.metadata,
          groundTruthPresent: !!jsonData.ground_truth,
          groundTruthKeys: Object.keys(jsonData.ground_truth || {}),
          ageGroupsProvided: ageGroups
        });
        setData(jsonData);
        
        // Extract available models
        const availableModels = new Set();
        Object.values(jsonData.forecasts || {}).forEach(dateData => {
          Object.values(dateData).forEach(ageData => {
            Object.values(ageData).forEach(targetData => {
              Object.keys(targetData).forEach(model => availableModels.add(model));
            });
          });
        });
        setModels(Array.from(availableModels).sort());
        
        // Set default model selection if none selected
        if (selectedModels.length === 0 && availableModels.size > 0) {
          setSelectedModels([Array.from(availableModels)[0]]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error || !data || !data.ground_truth || Object.keys(data.ground_truth).length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-100 bg-opacity-50 rounded-lg">
        <div className="text-gray-500 text-center p-4">
          No RSV forecast data available for this location
        </div>
      </div>
    );
  }

  console.log('Creating RSV traces:', {
    ageGroups,
    groundTruth: data.ground_truth,
    firstAge: data.ground_truth[ageGroups[0]]
  });

  // Create subplot traces for each age group
  const traces = ageGroups.map((age, index) => {
    const ageData = data.ground_truth[age] || {};
    const baseTrace = {
      x: ageData.dates || [],
      y: ageData.values || [],
      type: 'scatter',
      mode: 'lines+markers',
      name: `Age ${age} - Observed`,
      xaxis: `x${index + 1}`,
      yaxis: `y${index + 1}`,
      showlegend: true,
      line: { color: '#8884d8', width: 2 }
    };

    // Get forecast traces for selected models
    const modelTraces = selectedModels.flatMap(model => {
      const modelColor = MODEL_COLORS[selectedModels.indexOf(model) % MODEL_COLORS.length];
      // Get the most recent date's forecasts
      const mostRecentDate = Object.keys(data.forecasts || {}).sort().pop();
      const forecastData = data.forecasts[mostRecentDate]?.[age]?.['inc hosp']?.[model];
      
      if (!forecastData || forecastData.type !== 'quantile') return [];

      const predictions = forecastData.predictions || {};
      const horizons = Object.keys(predictions).sort((a, b) => parseInt(a) - parseInt(b));

      const forecastDates = [];
      const medianValues = [];
      const ci95Upper = [];
      const ci95Lower = [];
      const ci50Upper = [];
      const ci50Lower = [];

      horizons.forEach(horizon => {
        const pred = predictions[horizon];
        // Add target_end_date to forecast dates
        const targetDate = new Date(mostRecentDate);
        targetDate.setDate(targetDate.getDate() + parseInt(horizon) * 7);
        forecastDates.push(targetDate.toISOString().split('T')[0]);
        
        const { quantiles, values } = pred;
        if (!quantiles || !values) return;

        ci95Lower.push(values[quantiles.indexOf(0.025)] || 0);
        ci50Lower.push(values[quantiles.indexOf(0.25)] || 0);
        medianValues.push(values[quantiles.indexOf(0.5)] || 0);
        ci50Upper.push(values[quantiles.indexOf(0.75)] || 0);
        ci95Upper.push(values[quantiles.indexOf(0.975)] || 0);
      });

      return [
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci95Upper, ...ci95Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `${modelColor}10`,
          line: { color: 'transparent' },
          showlegend: false,
          type: 'scatter',
          name: `${model} 95% CI`,
          xaxis: `x${index + 1}`,
          yaxis: `y${index + 1}`
        },
        {
          x: [...forecastDates, ...forecastDates.slice().reverse()],
          y: [...ci50Upper, ...ci50Lower.slice().reverse()],
          fill: 'toself',
          fillcolor: `${modelColor}30`,
          line: { color: 'transparent' },
          showlegend: false,
          type: 'scatter',
          name: `${model} 50% CI`,
          xaxis: `x${index + 1}`,
          yaxis: `y${index + 1}`
        },
        {
          x: forecastDates,
          y: medianValues,
          name: `${model}`,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: modelColor, width: 2 },
          marker: { size: 6 },
          showlegend: true,
          xaxis: `x${index + 1}`,
          yaxis: `y${index + 1}`
        }
      ];
    });

    return [baseTrace, ...modelTraces];
  }).flat();

  const layout = {
    grid: {
      rows: 2,
      columns: 2,
      pattern: 'independent'
    },
    height: 600,
    margin: { l: 60, r: 30, t: 30, b: 30 },
    annotations: ageGroups.map((age, index) => ({
      text: `Age group ${age}`,
      xref: 'paper',
      yref: 'paper',
      x: index % 2 === 0 ? 0.15 : 0.85,
      y: index < 2 ? 0.95 : 0.45,
      showarrow: false,
      font: { size: 12 }
    }))
  };

  return (
    <div>
      <Plot
        data={traces}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false
        }}
        className="w-full"
      />
      <ModelSelector 
        models={models}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        getModelColor={(model, selectedModels) => {
          const index = selectedModels.indexOf(model);
          return MODEL_COLORS[index % MODEL_COLORS.length];
        }}
      />
    </div>
  );
};

export default RSVDefaultView;
