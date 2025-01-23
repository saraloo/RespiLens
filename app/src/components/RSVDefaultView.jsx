import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

const RSVDefaultView = ({ location, ageGroups = ["0-0.99", "1-4", "5-64", "65-130"] }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`./processed_data/rsv/${location}_rsv.json`);
        console.log('RSV fetch response:', response);
        if (!response.ok) {
          throw new Error('No RSV data available for this location');
        }
        const jsonData = await response.json();
        console.log('RSV data:', jsonData);
        setData(jsonData);
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

  if (error || !data || !data.ground_truth || !data.metadata || 
      !data.ground_truth[data.metadata.location] || 
      Object.keys(data.ground_truth[data.metadata.location]).length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-100 bg-opacity-50 rounded-lg">
        <div className="text-gray-500 text-center p-4">
          No RSV forecast data available for this location
        </div>
      </div>
    );
  }

  // Create subplot traces for each age group
  const traces = ageGroups.map((age, index) => {
    // RSV data is nested under location then age group
    const ageData = data.ground_truth[data.metadata.location]?.[age] || {};
    return {
      x: ageData.dates || [],
      y: ageData.values || [],
      type: 'scatter',
      mode: 'lines+markers',
      name: `Age ${age}`,
      xaxis: `x${index + 1}`,
      yaxis: `y${index + 1}`,
      showlegend: false
    };
  });

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
  );
};

export default RSVDefaultView;
