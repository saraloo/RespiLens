import os
import pandas as pd
import json
import numpy as np
from pathlib import Path
import logging
from typing import Optional, Dict, List
from tqdm import tqdm
import argparse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FluSightPreprocessor:
    def __init__(self, base_path: str, output_path: str, demo_mode: bool = False):
        """Initialize preprocessor with paths and mode settings"""
        self.base_path = Path(base_path)
        self.output_path = Path(output_path)
        self.demo_mode = demo_mode
        self.demo_models = ['UNC_IDD-influpaint', 'FluSight-ensemble']

        # Define paths
        self.model_output_path = self.base_path / "model-output"
        self.target_data_path = self.base_path / "target-data/target-hospital-admissions.csv"
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

        # Add model diversity logging and collect all models
        all_models = set()
        logger.info("Available locations: %s", list(self.forecast_data.keys()))
        for location, location_data in self.forecast_data.items():
            location_models = set()
            for date, date_data in location_data.items():
                for target, target_data in date_data.items():
                    location_models.update(target_data.keys())
                    all_models.update(target_data.keys())

            logger.info(f"Location {location} models: {sorted(list(location_models))}")

        # Store the all_models set as an instance variable
        self.all_models = all_models

        return self.forecast_data

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
        forecast_data = self.read_model_outputs()

        # Create output directory if it doesn't exist
        self.output_path.mkdir(parents=True, exist_ok=True)

        # Save metadata about available models
        metadata = {
            'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'models': sorted(list(self.all_models)),  # Use the collected models from read_model_outputs
            'locations': [
                {
                    'location': str(row.location),
                    'abbreviation': str(row.abbreviation),
                    'location_name': str(row.location_name),
                    'population': float(row.population)
                }
                for _, row in locations.iterrows()
                if pd.notna(row.location_name) and pd.notna(row.abbreviation)
            ],
            'demo_mode': self.demo_mode
        }

        # Create flusight subdirectory
        payload_path = self.output_path / "flusight"
        payload_path.mkdir(parents=True, exist_ok=True)

        with open(payload_path / 'metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        # Create and save location-specific payloads
        for _, location_info in tqdm(locations.iterrows(), desc="Creating location payloads"):
            location = location_info['location']

            # Convert pandas Series to dict first
            metadata_dict = {
                'location': str(location_info['location']),
                'abbreviation': str(location_info['abbreviation']),
                'location_name': str(location_info['location_name']),
                'population': float(location_info['population'])
            }

            payload = {
                'metadata': metadata_dict,
                'ground_truth': {
                    'dates': ground_truth.get(location, {'dates': []})['dates'],
                    'values': [None if pd.isna(x) else x for x in ground_truth.get(location, {'values': []})['values']],
                    'rates': [None if pd.isna(x) else x for x in ground_truth.get(location, {'rates': []})['rates']]
                },
                'forecasts': forecast_data.get(location, {})
            }

            # Save location payload with abbreviation in filename
            # Normalize the location abbreviation and remove any whitespace
            location_abbrev = str(location_info['abbreviation']).strip()
            if not location_abbrev:
                continue  # Skip if no valid abbreviation
            with open(payload_path / f"{location_abbrev}_flusight.json", 'w') as f:
                json.dump(payload, f, cls=NpEncoder)

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj) if not np.isnan(obj) else None
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

def main():
    parser = argparse.ArgumentParser(description='Process FluSight forecast data for visualization')
    parser.add_argument('--hub-path', type=str, default='./FluSight-forecast-hub',
                      help='Path to FluSight forecast hub repository')
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
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Files in current directory: {os.listdir()}")
        logger.info(f"Starting preprocessing with hub path: {args.hub_path}")
        logger.info(f"Output path: {args.output_path}")
        logger.info(f"Demo mode: {args.demo}")

        preprocessor = FluSightPreprocessor(args.hub_path, args.output_path, args.demo)
        preprocessor.create_visualization_payloads()

        logger.info("Processing complete!")

    except Exception as e:
        logger.error(f"Failed to run preprocessing: {str(e)}")
        raise

if __name__ == "__main__":
    main()
