# FluSight Plot Data Format

This document describes the optimized JSON data structure for plotting FluSight forecast data. The format is designed for efficient visualization and comparison of multiple forecast models across different locations and time periods.

## Data Structure Overview

```json
{
  "metadata": {
    "last_updated": "2024-01-18 12:00:00",
    "locations": {
      "01": {
        "name": "Alabama",
        "population": 5024279
      }
    },
    "available_dates": ["2024-01-01", ...],
    "available_models": ["model1", "model2", ...]
  },
  "truth": {
    "01": {
      "dates": [...],
      "values": [...],
      "rates": [...]
    }
  },
  "forecasts": {
    "01": {
      "reference_dates": {
        "2024-01-01": {
          "models": {
            "model1": {
              "quantiles": {
                "0": {
                  "date": "2024-01-01",
                  "quantiles": [0.025, 0.25, 0.5, 0.75, 0.975],
                  "values": [...]
                }
              },
              "pmf": {
                "0": {
                  "date": "2024-01-01",
                  "categories": [...],
                  "probabilities": [...]
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Design Benefits for Plotting

1. **Quick Location Access**
   - Direct access to location data using FIPS codes as keys
   - Location metadata (name, population) immediately available for plot labels
   - Avoids repeated location information

2. **Efficient Time Series Plotting**
   - Ground truth data separated and pre-formatted
   - Values already converted to appropriate types (integers for counts, floats for rates)
   - Dates pre-formatted as strings in consistent YYYY-MM-DD format

3. **Optimized Model Comparison**
   - Models grouped by reference date for easy temporal comparison
   - Pre-filtered quantiles (0.025, 0.25, 0.5, 0.75, 0.975) for standard visualizations
   - Consistent data structure across model types

4. **Quick UI Component Updates**
   - Available dates and models in metadata for dropdown population
   - No need for client-side data processing
   - Easy filtering for demo/comparison views

5. **Memory Efficient**
   - No duplicate metadata or location information
   - Data grouped logically to minimize redundancy
   - Clear separation of ground truth and forecast data

## Common Plotting Operations

1. **Time Series Plot**
```javascript
// Get ground truth data
const truthData = data.truth[location];
// Plot with dates on x-axis, values on y-axis

// Add forecast for specific date
const forecast = data.forecasts[location].reference_dates[date].models[model];
// Plot median and confidence intervals using quantiles
```

2. **Rate Change Plot**
```javascript
// Get categorical forecasts
const pmf = forecast.pmf["0"];  // Current week forecast
// Plot bar chart using categories and probabilities
```

3. **Model Comparison**
```javascript
// Get all models for a date
const modelData = data.forecasts[location].reference_dates[date].models;
// Compare quantiles or probabilities across models
```

## Data Types

- **Integers**: hospitalization counts, population
- **Floats**: probabilities, rates, quantiles
- **Strings**: dates (YYYY-MM-DD format), location names, model names
- **Arrays**: pre-sorted for direct plotting

## Best Practices

1. **Data Loading**
   - Load location data once at initialization
   - Cache frequently accessed reference dates
   - Use metadata for UI element population

2. **Plotting**
   - Use ground truth data as base layer
   - Add forecasts as overlays
   - Leverage consistent color schemes across plot types

3. **Updates**
   - Check metadata.last_updated for data freshness
   - Use available_models for dynamic component rendering
   - Filter locations and dates based on metadata lists

## Implementation Notes

- All dates are strings in YYYY-MM-DD format
- Quantile values are integers for hospitalization forecasts
- PMF probabilities sum to 1.0 for each horizon
- Missing or invalid values are represented as null
- Location keys match standard FIPS codes