import os
import pandas as pd
import glob
import json
from pathlib import Path

class FluSightPreprocessor:
    def __init__(self, base_path):
        """Initialize preprocessor with base path to the FluSight-forecast-hub repo"""
        self.base_path = Path(base_path)
        self.model_output_path = self.base_path / "model-output"
        self.target_data_path = self.base_path / "target-data"
        
        # Define the quantiles we want to keep
        self.keep_quantiles = [0.025, 0.25, 0.5, 0.75, 0.975]
        
        # Define targets we're interested in
        self.targets = [
            'wk inc flu hosp',
            'wk flu hosp rate change',
            'peak week inc flu hosp',
            'peak inc flu hosp'
        ]

    def read_model_outputs(self):
        """Read all model output files and combine them"""
        all_forecasts = []
        
        # Get all CSV and parquet files in model output directory and its subdirectories
        for model_dir in self.model_output_path.glob("*"):
            if not model_dir.is_dir():
                continue
                
            for file_path in model_dir.glob("*.csv"):
                df = pd.read_csv(file_path)
                all_forecasts.append(df)
                
            for file_path in model_dir.glob("*.parquet"):
                df = pd.read_parquet(file_path)
                all_forecasts.append(df)
        
        if not all_forecasts:
            raise ValueError("No forecast files found")
            
        combined_df = pd.concat(all_forecasts, ignore_index=True)
        return combined_df

    def filter_and_process_data(self, df):
        """Filter data to keep only required quantiles and process for visualization"""
        # Filter for quantile forecasts
        quantile_mask = (df['output_type'] == 'quantile') & \
                       (df['output_type_id'].astype(float).isin(self.keep_quantiles))
        
        # Filter for PMF forecasts
        pmf_mask = df['output_type'] == 'pmf'
        
        # Combine masks
        final_mask = quantile_mask | pmf_mask
        
        # Apply filters
        filtered_df = df[final_mask].copy()
        
        # Create separate dataframes for each target type
        target_dfs = {}
        for target in self.targets:
            target_df = filtered_df[filtered_df['target'] == target].copy()
            if not target_df.empty:
                target_dfs[target] = target_df
                
        return target_dfs

    def create_location_payloads(self, target_dfs):
        """Create visualization payloads for each location"""
        # Read locations file
        locations_df = pd.read_csv(self.base_path / "auxiliary-data/locations.csv")
        
        payloads = {}
        for location in locations_df['location']:
            location_payload = {
                'location': location,
                'forecasts': {}
            }
            
            # Process each target type
            for target, df in target_dfs.items():
                location_data = df[df['location'] == location]
                
                if not location_data.empty:
                    # Group by model and reference date
                    grouped = location_data.groupby(['reference_date', 'model'])
                    forecast_data = []
                    
                    for (ref_date, model), group in grouped:
                        forecast = {
                            'reference_date': ref_date,
                            'model': model,
                            'predictions': group.to_dict('records')
                        }
                        forecast_data.append(forecast)
                    
                    location_payload['forecasts'][target] = forecast_data
            
            payloads[location] = location_payload
            
        return payloads

    def save_payloads(self, payloads, output_dir):
        """Save payloads to JSON files"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        for location, payload in payloads.items():
            file_path = output_path / f"{location}_payload.json"
            with open(file_path, 'w') as f:
                json.dump(payload, f)

    def process(self, output_dir):
        """Run the full preprocessing pipeline"""
        print("Reading model outputs...")
        combined_df = self.read_model_outputs()
        
        print("Filtering and processing data...")
        target_dfs = self.filter_and_process_data(combined_df)
        
        print("Creating location payloads...")
        payloads = self.create_location_payloads(target_dfs)
        
        print("Saving payloads...")
        self.save_payloads(payloads, output_dir)
        
        print("Processing complete!")
        return payloads

def main():
    # Example usage
    preprocessor = FluSightPreprocessor("path/to/FluSight-forecast-hub")
    preprocessor.process("processed_data")

if __name__ == "__main__":
    main()
