# FluSight Data Processing

This repository contains tools for processing FluSight forecast data into a format suitable for visualization.

## JSON Data Format

The processed data is saved in JSON files with the following structure:

### Location Payload
```json
{
  "metadata": {
    "location": "US",
    "location_name": "United States",
    "population": 331893745,
    "abbreviation": "US"
  },
  "ground_truth": {
    "dates": ["2023-01-01", "2023-01-08", ...],
    "values": [1234, 1456, ...],
    "weekly_rates": [0.037, 0.043, ...]
  },
  "forecasts": {
    "wk inc flu hosp": [
      {
        "reference_date": "2023-01-01",
        "model": "FluSight-ensemble",
        "data": {
          "type": "quantile",
          "quantiles": [0.025, 0.25, 0.5, 0.75, 0.975],
          "horizons": {
            "0": {
              "date": "2023-01-01",
              "values": [1200, 1300, 1400, 1500, 1600, 1700, 1800]
            },
            "1": {
              "date": "2023-01-08",
              "values": [1400, 1500, 1600, 1700, 1800, 1900, 2000]
            }
          }
        }
      }
    ],
    "wk flu hosp rate change": [
      {
        "reference_date": "2023-01-01",
        "model": "FluSight-ensemble",
        "data": {
          "type": "pmf",
          "horizons": {
            "0": {
              "date": "2023-01-01",
              "categories": ["large_decrease", "decrease", "stable", "increase", "large_increase"],
              "values": [0.1, 0.2, 0.4, 0.2, 0.1]
            }
          }
        }
      }
    ]
  }
}
```

### Key Fields

- **metadata**: Contains location information including name, population, and abbreviation
- **ground_truth**: Historical hospitalization data with dates, values, and weekly rates
- **forecasts**: Contains forecast data for different targets:
  - `wk inc flu hosp`: Weekly incident hospitalizations
  - `wk flu hosp rate change`: Weekly hospitalization rate change
  - `peak week inc flu hosp`: Peak week hospitalizations
  - `peak inc flu hosp`: Peak hospitalizations

Each forecast contains:
- `reference_date`: Date the forecast was made
- `model`: Name of the forecasting model
- `data`: Contains either:
  - Quantile forecasts with values for specific quantiles
  - PMF forecasts with probability mass functions

### Manifest File
A `manifest.json` file is created with metadata about all available locations:
```json
{
  "last_updated": "2023-01-01 12:00:00",
  "locations": ["US", "AL", "AK", ...],
  "total_locations": 52
}
```
