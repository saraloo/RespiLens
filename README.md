# FluSight Visualization Data Format

This document describes the data format used for the FluSight visualization payloads. The preprocessed data is organized into multiple JSON files: a metadata file and individual location files.

## Directory Structure

```
processed_data/
├── metadata.json         # Global metadata and available options
├── US.json              # National level forecasts and data
├── 01.json             # Alabama forecasts and data
├── 02.json             # Alaska forecasts and data
└── ...                 # Other state/territory files
```

## Metadata File Format

The `metadata.json` file contains global information about the available data:

```json
{
  "last_updated": "2024-01-18 15:30:00",
  "models": ["UNC_IDD-influpaint", "FluSight-ensemble", ...],
  "locations": ["US", "01", "02", ...],
  "demo_mode": false
}
```

| Field | Description |
|-------|-------------|
| `last_updated` | Timestamp of when the data was last processed |
| `models` | Array of available model identifiers |
| `locations` | Array of available location codes |
| `demo_mode` | Boolean indicating if this is demo data (limited models) |

## Location File Format

Each location file (e.g., `US.json`, `01.json`) contains three main sections:

```json
{
  "metadata": {
    "location": "01",
    "location_name": "Alabama",
    "population": 5024279
  },
  "ground_truth": {
    "dates": ["2023-10-01", "2023-10-08", ...],
    "values": [120, 145, ...],
    "rates": [2.4, 2.9, ...]
  },
  "forecasts": {
    "2024-01-13": {
      "wk inc flu hosp": {
        "UNC_IDD-influpaint": {
          "type": "quantile",
          "predictions": {
            "0": {
              "date": "2024-01-13",
              "quantiles": [0.025, 0.25, 0.5, 0.75, 0.975],
              "values": [100, 120, 130, 140, 160]
            },
            "1": {
              "date": "2024-01-20",
              "quantiles": [0.025, 0.25, 0.5, 0.75, 0.975],
              "values": [110, 130, 140, 150, 170]
            }
          }
        }
      },
      "wk flu hosp rate change": {
        "UNC_IDD-influpaint": {
          "type": "pmf",
          "predictions": {
            "0": {
              "date": "2024-01-13",
              "categories": ["large_decrease", "decrease", "stable", "increase", "large_increase"],
              "probabilities": [0.1, 0.2, 0.4, 0.2, 0.1]
            }
          }
        }
      }
    }
  }
}
```

### Metadata Section

Location-specific metadata:

| Field | Description |
|-------|-------------|
| `location` | Location code (e.g., "01" for Alabama) |
| `location_name` | Human-readable location name |
| `population` | Population size used for rate calculations |

### Ground Truth Section

Historical observed data:

| Field | Description |
|-------|-------------|
| `dates` | Array of dates in YYYY-MM-DD format |
| `values` | Array of observed hospitalization counts |
| `rates` | Array of hospitalization rates per 100k population |

### Forecasts Section

The forecasts section is organized hierarchically:

1. Reference Date (YYYY-MM-DD)
   - The Saturday of the submission week
2. Target Type
   - `wk inc flu hosp`: Weekly incident hospitalizations
   - `wk flu hosp rate change`: Weekly rate change categories
   - `peak week inc flu hosp`: Peak week prediction
   - `peak inc flu hosp`: Peak incidence prediction
3. Model Name
   - Contains predictions for each model
4. Prediction Data
   - Type-specific format for each kind of prediction

#### Quantile Predictions Format

Used for incident hospitalizations:

```json
{
  "type": "quantile",
  "predictions": {
    "0": {
      "date": "2024-01-13",
      "quantiles": [0.025, 0.25, 0.5, 0.75, 0.975],
      "values": [100, 120, 130, 140, 160]
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | Always "quantile" |
| `predictions` | Object with horizons as keys (0-3) |
| `date` | Target end date for the prediction |
| `quantiles` | Array of quantile levels |
| `values` | Array of predicted values for each quantile |

#### PMF Predictions Format

Used for rate change categories:

```json
{
  "type": "pmf",
  "predictions": {
    "0": {
      "date": "2024-01-13",
      "categories": ["large_decrease", "decrease", "stable", "increase", "large_increase"],
      "probabilities": [0.1, 0.2, 0.4, 0.2, 0.1]
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | Always "pmf" |
| `predictions` | Object with horizons as keys (0-3) |
| `date` | Target end date for the prediction |
| `categories` | Array of category names |
| `probabilities` | Array of probability values summing to 1 |

#### Sample Predictions Format

Used for trajectory samples:

```json
{
  "type": "sample",
  "predictions": {
    "0": {
      "date": "2024-01-13",
      "samples": [120, 125, 130, ...]
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | Always "sample" |
| `predictions` | Object with horizons as keys (0-3) |
| `date` | Target end date for the prediction |
| `samples` | Array of sample values |

## Usage Notes

1. All dates use ISO format (YYYY-MM-DD)
2. Horizons are stored as strings ("0", "1", "2", "3")
3. Values for incident hospitalizations are always integers
4. PMF probabilities always sum to 1.0
5. Sample trajectories contain exactly 100 samples per horizon
6. Missing data is represented by empty arrays or null values