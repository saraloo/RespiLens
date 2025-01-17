import os
import pandas as pd
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FluSightPlotProcessor:
    def __init__(self, base_path: str, output_path: str):
        self.base_path = Path(base_path)
        self.output_path = Path(output_path)
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Only keep essential quantiles for plotting
        self.plot_quantiles = [0.025, 0.25, 0.5, 0.75, 0.975]

    def process_and_save(self):
        """Single-pass processing of all data"""
        # Read metadata first (small file)
        locations_df = pd.read_csv(self.base_path / "auxiliary-data/locations.csv")
        location_metadata = {
            row['location']: {
                'name': row['location_name'],
                'population': row['population']
            } for _, row in locations_df.iterrows()
        }

        # Read ground truth data (single read)
        truth_df = pd.read_csv(self.base_path / "target-data/target-hospital-admissions.csv")
        truth_df['date'] = pd.to_datetime(truth_df['date']).dt.strftime('%Y-%m-%d')
        truth_data = {
            loc: {
                'dates': group['date'].tolist(),
                'values': group['value'].tolist(),
                'rates': group['weekly_rate'].tolist()
            }
            for loc, group in truth_df.groupby('location')
        }

        # Process forecast files in a single pass
        forecasts = {}
        available_models = set()
        available_dates = set()

        # Get all forecast files
        forecast_files = []
        for ext in ['*.csv', '*.parquet']:
            forecast_files.extend(self.base_path.glob(f"model-output/**/{ext}"))

        # Process each file
        for file_path in forecast_files:
            model_name = file_path.parent.name
            available_models.add(model_name)
            
            # Read file
            df = pd.read_parquet(file_path) if file_path.suffix == '.parquet' else pd.read_csv(file_path)
            
            # Basic date processing
            df['reference_date'] = pd.to_datetime(df['reference_date']).dt.strftime('%Y-%m-%d')
            available_dates.update(df['reference_date'].unique())

            # Process quantiles and pmf in single pass
            for (location, ref_date), group in df.groupby(['location', 'reference_date']):
                if location not in forecasts:
                    forecasts[location] = {'reference_dates': {}}
                
                if ref_date not in forecasts[location]['reference_dates']:
                    forecasts[location]['reference_dates'][ref_date] = {'models': {}}
                
                # Extract model data
                model_data = {}
                
                # Handle quantiles
                quantile_data = group[group['output_type'] == 'quantile'].copy()
                if not quantile_data.empty:
                    # Convert output_type_id to float only for quantile data
                    quantile_data['output_type_id'] = pd.to_numeric(quantile_data['output_type_id'])
                    quantile_mask = quantile_data['output_type_id'].isin(self.plot_quantiles)
                    quantile_group = quantile_data[quantile_mask]
                    model_data['quantiles'] = {
                        horizon: {
                            'date': h_group['target_end_date'].iloc[0],
                            'quantiles': h_group['output_type_id'].astype(float).tolist(),
                            'values': h_group['value'].tolist()
                        }
                        for horizon, h_group in quantile_group.groupby('horizon')
                    }
                
                # Handle PMF
                pmf_group = group[group['output_type'] == 'pmf']
                if not pmf_group.empty:
                    model_data['pmf'] = {
                        horizon: {
                            'date': h_group['target_end_date'].iloc[0],
                            'categories': h_group['output_type_id'].tolist(),
                            'probabilities': h_group['value'].tolist()
                        }
                        for horizon, h_group in pmf_group.groupby('horizon')
                    }
                
                if model_data:
                    forecasts[location]['reference_dates'][ref_date]['models'][model_name] = model_data

        # Create final payload
        payload = {
            'metadata': {
                'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                'locations': location_metadata,
                'available_dates': sorted(list(available_dates)),
                'available_models': sorted(list(available_models))
            },
            'truth': truth_data,
            'forecasts': forecasts
        }

        # Save output
        output_file = self.output_path / 'plot_data.json'
        with open(output_file, 'w') as f:
            json.dump(payload, f)
        
        logger.info(f"Saved plot data to {output_file}")

def main():
    hub_path = os.getenv('FLUSIGHT_HUB_PATH', './FluSight-forecast-hub')
    output_path = os.getenv('OUTPUT_PATH', './processed_data')
    
    processor = FluSightPlotProcessor(hub_path, output_path)
    processor.process_and_save()

if __name__ == "__main__":
    main()