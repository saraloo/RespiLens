import os
import pandas as pd
import json
from pathlib import Path
import logging
from typing import Optional
from .validation_plots import ValidationPlotter

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_env_path(var_name: str, default: Optional[str] = None) -> str:
    """Get path from environment variable and validate it"""
    path = os.getenv(var_name, default)
    if path is None:
        raise ValueError(f"Environment variable {var_name} must be set")
    return path

class FluSightPreprocessor:
    def __init__(self, base_path: str, output_path: str):
        """Initialize preprocessor with paths set by environment variables"""
        self.base_path = Path(base_path)
        self.output_path = Path(output_path)
        self.model_output_path = self.base_path / "model-output"
        self.target_data_path = self.base_path / "target-data/target-hospital-admissions.csv"
        
        # Validate paths
        if not self.base_path.exists():
            raise ValueError(f"Base path does not exist: {self.base_path}")
        if not self.model_output_path.exists():
            raise ValueError(f"Model output path does not exist: {self.model_output_path}")
        if not self.target_data_path.exists():
            raise ValueError(f"Target data file does not exist: {self.target_data_path}")
            
        # Create output directory if it doesn't exist
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Define the quantiles we want to keep
        self.keep_quantiles = [0.025, 0.25, 0.5, 0.75, 0.975]
        
        # Define targets we're interested in
        self.targets = [
            'wk inc flu hosp',
            'wk flu hosp rate change',
            'peak week inc flu hosp',
            'peak inc flu hosp'
        ]

    def read_ground_truth_data(self):
        """Read and process ground truth hospitalization data"""
        logger.info("Reading ground truth data...")
        try:
            df = pd.read_csv(self.target_data_path)
            # Convert date column to datetime
            df['date'] = pd.to_datetime(df['date'])
            # Filter to only include dates from October 1st, 2023 onwards
            df = df[df['date'] >= pd.Timestamp('2023-10-01')]
            # Convert date to string format
            df['date'] = df['date'].dt.strftime('%Y-%m-%d')
            
            # Group data by location
            ground_truth = {}
            for location, group in df.groupby('location'):
                ground_truth[location] = {
                    'dates': group['date'].tolist(),
                    'values': group['value'].tolist(),
                    'weekly_rates': group['weekly_rate'].tolist()
                }
            
            logger.info(f"Processed ground truth data for {len(ground_truth)} locations")
            return ground_truth
        except Exception as e:
            logger.error(f"Error reading ground truth data: {str(e)}")
            raise

    def read_model_outputs(self):
        """Read all model output files and combine them"""
        all_forecasts = []
        
        logger.info("Reading model output files...")
        files_processed = 0
        error_count = 0
        
        for model_dir in self.model_output_path.glob("*"):
            if not model_dir.is_dir():
                continue
            
            logger.info(f"Processing directory: {model_dir.name}")
            model_name = model_dir.name
                
            for file_path in model_dir.glob("*.csv"):
                try:
                    df = pd.read_csv(file_path)
                    df['model'] = model_name
                    all_forecasts.append(df)
                    files_processed += 1
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error reading {file_path}: {str(e)}")
                
            for file_path in model_dir.glob("*.parquet"):
                try:
                    df = pd.read_parquet(file_path)
                    df['model'] = model_name
                    all_forecasts.append(df)
                    files_processed += 1
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error reading {file_path}: {str(e)}")
        
        if not all_forecasts:
            raise ValueError("No forecast files found")
            
        combined_df = pd.concat(all_forecasts, ignore_index=True)
        logger.info(f"Combined {len(all_forecasts)} forecast files into {len(combined_df)} rows")
        return combined_df

    def filter_and_process_data(self, df):
        """Filter data to keep only required quantiles"""
        logger.info("Filtering and processing data...")
        
        # Create mask for PMF forecasts
        pmf_mask = df['output_type'] == 'pmf'
        
        # Create mask for quantile forecasts
        quantile_rows = df[df['output_type'] == 'quantile'].copy()
        if not quantile_rows.empty:
            quantile_rows['output_type_id'] = pd.to_numeric(quantile_rows['output_type_id'])
            quantile_mask = quantile_rows['output_type_id'].isin(self.keep_quantiles)
            quantile_indices = quantile_rows[quantile_mask].index
        else:
            quantile_indices = pd.Index([])
        
        # Combine masks using indices
        final_mask = df.index.isin(quantile_indices) | pmf_mask
        
        # Apply filters
        filtered_df = df[final_mask].copy()
        logger.info(f"Filtered from {len(df)} to {len(filtered_df)} rows")
        
        # Create separate dataframes for each target type
        target_dfs = {}
        for target in self.targets:
            target_df = filtered_df[filtered_df['target'] == target].copy()
            if not target_df.empty:
                target_dfs[target] = target_df
                logger.info(f"Processed {len(target_df)} rows for target {target}")
                
        return target_dfs

    def create_location_payloads(self, target_dfs, ground_truth_data):
        """Create visualization payloads for each location with reorganized forecast structure"""
        logger.info("Creating location payloads...")
        
        try:
            locations_df = pd.read_csv(self.base_path / "auxiliary-data/locations.csv")
        except Exception as e:
            logger.error(f"Error reading locations file: {str(e)}")
            raise
        
        payloads = {}
        for location in locations_df['location']:
            logger.debug(f"Processing location: {location}")
            metadata = locations_df[locations_df['location'] == location].iloc[0].to_dict()
            
            # Initialize the location payload with metadata and ground truth
            location_payload = {
                'metadata': metadata,
                'ground_truth': ground_truth_data.get(location, {
                    'dates': [],
                    'values': [],
                    'weekly_rates': []
                }),
                'forecasts': {}
            }
            
            # Process each target type
            for target, df in target_dfs.items():
                location_data = df[df['location'] == location].copy()
                
                if not location_data.empty:
                    # Convert dates to strings
                    location_data['reference_date'] = pd.to_datetime(location_data['reference_date']).dt.strftime('%Y-%m-%d')
                    location_data['target_end_date'] = pd.to_datetime(location_data['target_end_date']).dt.strftime('%Y-%m-%d')
                    
                    # Group by reference_date first
                    for reference_date, date_group in location_data.groupby('reference_date'):
                        if reference_date not in location_payload['forecasts']:
                            location_payload['forecasts'][reference_date] = {}
                        
                        if target not in location_payload['forecasts'][reference_date]:
                            location_payload['forecasts'][reference_date][target] = {'models': {}}
                        
                        # Then group by model within each reference_date
                        for model, model_group in date_group.groupby('model'):
                            forecast_data = self.process_forecast_data(model_group)
                            location_payload['forecasts'][reference_date][target]['models'][model] = forecast_data
            
            payloads[location] = location_payload
            
        logger.info(f"Created payloads for {len(payloads)} locations")
        return payloads

    def process_forecast_data(self, group_df):
        """Convert DataFrame of predictions into optimized format"""
        output_type = group_df['output_type'].iloc[0]
        
        if output_type == 'quantile':
            # For quantile forecasts, store values by horizon with shared quantiles
            quantiles = sorted(group_df['output_type_id'].astype(float).unique().tolist())
            horizons = {}
            
            for horizon, horizon_df in group_df.groupby('horizon'):
                horizon_df = horizon_df.sort_values('output_type_id')  # Ensure consistent order
                horizons[str(int(horizon))] = {
                    'date': horizon_df['target_end_date'].iloc[0],
                    'values': horizon_df['value'].tolist()
                }
            
            return {
                'type': 'quantile',
                'quantiles': quantiles,
                'horizons': horizons
            }
        else:  # pmf output
            horizons = {}
            for horizon, horizon_df in group_df.groupby('horizon'):
                horizon_df = horizon_df.sort_values('output_type_id')  # Ensure consistent order
                horizons[str(int(horizon))] = {
                    'date': horizon_df['target_end_date'].iloc[0],
                    'categories': horizon_df['output_type_id'].tolist(),
                    'values': horizon_df['value'].tolist()
                }
            
            return {
                'type': 'pmf',
                'horizons': horizons
            }
        

    def save_payloads(self, payloads):
        """Save payloads to JSON files in the specified output directory"""
        logger.info(f"Saving payloads to {self.output_path}")
        
        # Create manifest with available locations and last update time
        manifest = {
            'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'locations': sorted(list(payloads.keys())),
            'total_locations': len(payloads)
        }
        
        # Ensure output directory exists
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Save manifest
        manifest_path = self.output_path / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        # Save individual location files and generate validation plots
        for location, payload in payloads.items():
            file_path = self.output_path / f"{location}.json"
            with open(file_path, 'w') as f:
                json.dump(payload, f)
            
            # Generate validation plots
            try:
                self.plotter.generate_validation_plots(payload, location)
                logger.info(f"Generated validation plots for {location}")
            except Exception as e:
                logger.error(f"Error generating validation plots for {location}: {str(e)}")

    def process(self):
        """Run the full preprocessing pipeline"""
        try:
            logger.info("Starting preprocessing pipeline...")
            
            # Read ground truth data first
            ground_truth_data = self.read_ground_truth_data()
            
            # Process model outputs
            combined_df = self.read_model_outputs()
            target_dfs = self.filter_and_process_data(combined_df)
            
            # Create payloads with both forecast and ground truth data
            payloads = self.create_location_payloads(target_dfs, ground_truth_data)
            self.save_payloads(payloads)
            
            logger.info("Processing complete!")
            return payloads
            
        except Exception as e:
            logger.error(f"Error during processing: {str(e)}")
            raise

def main():
    try:
        hub_path = get_env_path('FLUSIGHT_HUB_PATH', './FluSight-forecast-hub')
        output_path = get_env_path('OUTPUT_PATH', './processed_data')
        
        log_level = os.getenv('LOG_LEVEL', 'INFO')
        logging.getLogger().setLevel(log_level)
        
        logger.info(f"Using hub path: {hub_path}")
        logger.info(f"Using output path: {output_path}")
        
        preprocessor = FluSightPreprocessor(hub_path, output_path)
        preprocessor.process()
        
    except Exception as e:
        logger.error(f"Failed to run preprocessing: {str(e)}")
        raise

if __name__ == "__main__":
    main()
