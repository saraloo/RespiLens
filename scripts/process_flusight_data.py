import os
import pandas as pd
import json
from pathlib import Path
import logging
from typing import Optional, Dict, List
from tqdm import tqdm
import argparse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FluSightPreprocessor:
    def __init__(self, base_path: str, rsv_path: str, output_path: str, demo_mode: bool = False):
        """Initialize preprocessor with paths and mode settings"""
        self.base_path = Path(base_path)
        self.rsv_path = Path(rsv_path)  # Add RSV hub path
        self.output_path = Path(output_path)
        self.demo_mode = demo_mode
        self.demo_models = ['UNC_IDD-influpaint', 'FluSight-ensemble']
        
        # Define paths for both hubs
        self.model_output_path = self.base_path / "model-output"
        self.rsv_output_path = self.rsv_path / "model-output"  # Add RSV model output path
        self.target_data_path = self.base_path / "target-data/target-hospital-admissions.csv"
        self.rsv_target_data_path = self.rsv_path / "target-data/target-rsv-admissions.csv"  # Add RSV target path
        self.locations_path = self.base_path / "auxiliary-data/locations.csv"
        
        # Validate paths exist
        self._validate_paths()
        
        # Create output directory
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Cache for processed data
        self.locations_data = None
        self.ground_truth = None
        self.forecast_data = None

    def _validate_paths(self):
        """Validate all required paths exist"""
        required_paths = {
            'base_path': self.base_path,
            'model_output_path': self.model_output_path,
            'target_data_path': self.target_data_path,
            'locations_path': self.locations_path
        }
        
        for name, path in required_paths.items():
            if not path.exists():
                raise ValueError(f"{name} does not exist: {path}")

    def load_locations(self) -> pd.DataFrame:
        """Load and cache locations data"""
        if self.locations_data is None:
            logger.info("Loading locations data...")
            self.locations_data = pd.read_csv(self.locations_path)
        return self.locations_data

    def load_ground_truth(self) -> Dict:
        """Load and process ground truth data"""
        if self.ground_truth is None:
            logger.info("Loading ground truth data...")
            df = pd.read_csv(self.target_data_path)
            df['date'] = pd.to_datetime(df['date'])
            
            # Filter to relevant dates and sort
            df = df[df['date'] >= pd.Timestamp('2023-10-01')].sort_values('date')
            df['date_str'] = df['date'].dt.strftime('%Y-%m-%d')
            
            # Create optimized structure for visualization
            self.ground_truth = {}
            for location in df['location'].unique():
                loc_data = df[df['location'] == location]
                self.ground_truth[location] = {
                    'dates': loc_data['date_str'].tolist(),
                    'values': loc_data['value'].tolist(),
                    'rates': loc_data['weekly_rate'].tolist()
                }
                
        return self.ground_truth

    def read_model_outputs(self) -> Dict:
        """Read and process all model output files efficiently"""
        if self.forecast_data is not None:
            return self.forecast_data
            
        logger.info("Reading model output files...")
        self.forecast_data = {}
        
        # Get list of model directories
        model_dirs = [d for d in self.model_output_path.glob("*") if d.is_dir()]
        if self.demo_mode:
            model_dirs = [d for d in model_dirs if d.name in self.demo_models]
            
        # Progress bar for model processing
        for model_dir in tqdm(model_dirs, desc="Processing models"):
            model_name = model_dir.name
            
            # Get all CSV and parquet files
            files = list(model_dir.glob("*.csv")) + list(model_dir.glob("*.parquet"))
            
            for file_path in files:
                try:
                    # Read file based on extension
                    if file_path.suffix == '.csv':
                        df = pd.read_csv(file_path)
                    else:  # .parquet
                        df = pd.read_parquet(file_path)
                        
                    # Process dates
                    # remove samples if any
                    df = df[~df['output_type'].str.contains('sample')]
                    df['reference_date'] = pd.to_datetime(df['reference_date'])
                    if 'target_end_date' in df.columns:
                        df['target_end_date'] = pd.to_datetime(df['target_end_date'])
                    
                    # Group by location and organize data
                    for location, loc_group in df.groupby('location'):
                        if location not in self.forecast_data:
                            self.forecast_data[location] = {}
                            
                        # Group by reference date
                        for ref_date, date_group in loc_group.groupby('reference_date'):
                            ref_date_str = ref_date.strftime('%Y-%m-%d')
                            
                            if ref_date_str not in self.forecast_data[location]:
                                self.forecast_data[location][ref_date_str] = {}
                                
                            # Group by target type
                            for target, target_group in date_group.groupby('target'):
                                if target not in self.forecast_data[location][ref_date_str]:
                                    self.forecast_data[location][ref_date_str][target] = {}
                                    
                                # Store model predictions
                                model_data = self._process_model_predictions(target_group)
                                self.forecast_data[location][ref_date_str][target][model_name] = model_data
                                
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {str(e)}")
                    continue
                    
        return self.forecast_data

    def read_rsv_outputs(self) -> Dict:
        """Read and process RSV model output files"""
        logger.info("Reading RSV model output files...")
        rsv_data = {}
        
        # Get list of model directories
        model_dirs = [d for d in self.rsv_output_path.glob("*") if d.is_dir()]
        
        # Progress bar for model processing
        for model_dir in tqdm(model_dirs, desc="Processing RSV models"):
            model_name = model_dir.name
            
            # Get all parquet files (RSV hub uses parquet format)
            files = list(model_dir.glob("*.parquet"))
            
            for file_path in files:
                try:
                    # Read parquet file
                    df = pd.read_parquet(file_path)
                    
                    # Filter for sample output type only
                    df = df[df['output_type'] == 'sample']
                    
                    # Process dates
                    df['origin_date'] = pd.to_datetime(df['origin_date'])
                    
                    # Group by location and organize data
                    for location, loc_group in df.groupby('location'):
                        if location not in rsv_data:
                            rsv_data[location] = {}
                            
                        # Group by origin date
                        for origin_date, date_group in loc_group.groupby('origin_date'):
                            origin_date_str = origin_date.strftime('%Y-%m-%d')
                            
                            if origin_date_str not in rsv_data[location]:
                                rsv_data[location][origin_date_str] = {}
                                
                            # Group by age group
                            for age_group, age_group_data in date_group.groupby('age_group'):
                                if age_group not in rsv_data[location][origin_date_str]:
                                    rsv_data[location][origin_date_str][age_group] = {}
                                
                                # Store model predictions
                                rsv_data[location][origin_date_str][age_group][model_name] = {
                                    'type': 'sample',
                                    'predictions': self._process_rsv_predictions(age_group_data)
                                }
                                
                except Exception as e:
                    logger.error(f"Error processing RSV file {file_path}: {str(e)}")
                    continue
                        
        return rsv_data

    def _process_rsv_predictions(self, group_df: pd.DataFrame) -> Dict:
        """Process RSV model predictions into optimized format"""
        predictions = {}
        for horizon, horizon_df in group_df.groupby('horizon'):
            predictions[str(int(horizon))] = {
                'samples': horizon_df['value'].tolist()
            }
        return predictions

    def _process_model_predictions(self, group_df: pd.DataFrame) -> Dict:
        """Process model predictions into an optimized format for visualization"""
        output_type = group_df['output_type'].iloc[0]
        
        if output_type == 'quantile':
            # For quantiles, create a structure optimized for plotting
            predictions = {}
            for horizon, horizon_df in group_df.groupby('horizon'):
                horizon_df = horizon_df.sort_values('output_type_id')
                predictions[str(int(horizon))] = {
                    'date': horizon_df['target_end_date'].iloc[0].strftime('%Y-%m-%d'),
                    'quantiles': horizon_df['output_type_id'].astype(float).tolist(),
                    'values': horizon_df['value'].tolist()
                }
            return {'type': 'quantile', 'predictions': predictions}
            
        elif output_type == 'pmf':
            # For probability mass functions
            predictions = {}
            for horizon, horizon_df in group_df.groupby('horizon'):
                predictions[str(int(horizon))] = {
                    'date': horizon_df['target_end_date'].iloc[0].strftime('%Y-%m-%d'),
                    'categories': horizon_df['output_type_id'].tolist(),
                    'probabilities': horizon_df['value'].tolist()
                }
            return {'type': 'pmf', 'predictions': predictions}
            
        else:  # sample
            predictions = {}
            for horizon, horizon_df in group_df.groupby('horizon'):
                predictions[str(int(horizon))] = {
                    'date': horizon_df['target_end_date'].iloc[0].strftime('%Y-%m-%d'),
                    'samples': horizon_df['value'].tolist()
                }
            return {'type': 'sample', 'predictions': predictions}

    def create_visualization_payloads(self):
        """Create optimized payloads for visualization"""
        logger.info("Creating visualization payloads...")
        
        # Load required data
        locations = self.load_locations()
        ground_truth = self.load_ground_truth()
        flu_forecast_data = self.read_model_outputs()
        rsv_forecast_data = self.read_rsv_outputs()
        
        # Create output directories
        (self.output_path / "flu").mkdir(parents=True, exist_ok=True)
        (self.output_path / "rsv").mkdir(parents=True, exist_ok=True)
        
        # Save metadata about available models
        metadata = {
            'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'flu_models': list(set(model 
                for loc_data in flu_forecast_data.values() 
                for date_data in loc_data.values() 
                for target_data in date_data.values() 
                for model in target_data.keys()
            )),
            'rsv_models': list(set(model
                for loc_data in rsv_forecast_data.values()
                for date_data in loc_data.values()
                for age_data in date_data.values()
                for model in age_data.keys()
            )),
            'locations': [
                {
                    'location': str(loc['location']),
                    'abbreviation': str(loc['abbreviation']),
                    'location_name': str(loc['location_name']),
                    'population': float(loc['population'])
                }
                for _, loc in locations.iterrows()
                if pd.notna(loc['location_name']) and pd.notna(loc['abbreviation'])
            ],
            'demo_mode': self.demo_mode
        }
        
        with open(self.output_path / 'metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Create and save location-specific payloads
        for _, location_info in tqdm(locations.iterrows(), desc="Creating location payloads"):
            location = location_info['location']
            
            # Flu payload
            flu_payload = {
                'metadata': location_info,
                'ground_truth': ground_truth.get(location, {'dates': [], 'values': [], 'rates': []}),
                'forecasts': flu_forecast_data.get(location, {})
            }
            
            # RSV payload
            rsv_payload = {
                'metadata': location_info,
                'ground_truth': ground_truth.get(location, {'dates': [], 'values': [], 'rates': []}),
                'forecasts': rsv_forecast_data.get(location, {})
            }
            
            location_abbrev = str(location_info['abbreviation']).strip()
            if not location_abbrev:
                continue
                
            # Save separate files for flu and RSV
            with open(self.output_path / "flu" / f"{location_abbrev}_flusight.json", 'w') as f:
                json.dump(flu_payload, f)
                
            with open(self.output_path / "rsv" / f"{location_abbrev}_rsvsight.json", 'w') as f:
                json.dump(rsv_payload, f)

def main():
    parser = argparse.ArgumentParser(description='Process FluSight forecast data for visualization')
    parser.add_argument('--flu-hub-path', type=str, default='./FluSight-forecast-hub',
                      help='Path to FluSight forecast hub repository')
    parser.add_argument('--rsv-hub-path', type=str, default='./rsv-forecast-hub',
                      help='Path to RSV forecast hub repository')  
    parser.add_argument('--output-path', type=str, default='./processed_data',
                      help='Path for output files')
    parser.add_argument('--demo', action='store_true',
                      help='Run in demo mode with only UNC_IDD-influpaint and FluSight-ensemble models')
    parser.add_argument('--log-level', type=str, default='INFO',
                      choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                      help='Set logging level')
    
    args = parser.parse_args()
    
    # Set logging level
    logging.getLogger().setLevel(args.log_level)
    
    try:
        # Update these log messages to use the new argument names
        logger.info(f"Starting preprocessing with FluSight hub path: {args.flu_hub_path}")
        logger.info(f"Starting preprocessing with RSV hub path: {args.rsv_hub_path}")
        logger.info(f"Output path: {args.output_path}")
        logger.info(f"Demo mode: {args.demo}")
        
        # Update the preprocessor initialization
        preprocessor = FluSightPreprocessor(
            args.flu_hub_path, 
            args.rsv_hub_path,
            args.output_path, 
            args.demo
        )
        preprocessor.create_visualization_payloads()
        
        logger.info("Processing complete!")
        
    except Exception as e:
        logger.error(f"Failed to run preprocessing: {str(e)}")
        raise

if __name__ == "__main__":
    main()
