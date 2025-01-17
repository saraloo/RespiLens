import os
import pandas as pd
import json
from pathlib import Path
import logging
from typing import Optional, Dict, List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FluSightPlotProcessor:
    def __init__(self, base_path: str, output_path: str):
        """Initialize processor with paths"""
        self.base_path = Path(base_path)
        self.output_path = Path(output_path)
        self.model_output_path = self.base_path / "model-output"
        self.target_data_path = self.base_path / "target-data/target-hospital-admissions.csv"
        
        # Create output directory
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Define key quantiles for visualization
        self.plot_quantiles = [0.025, 0.25, 0.5, 0.75, 0.975]
        
        # Define targets
        self.targets = [
            'wk inc flu hosp',
            'wk flu hosp rate change',
            'peak week inc flu hosp',
            'peak inc flu hosp'
        ]

    def read_ground_truth(self) -> Dict:
        """Read and process ground truth data into plotting format"""
        logger.info("Reading ground truth data...")
        df = pd.read_csv(self.target_data_path)
        df['date'] = pd.to_datetime(df['date'])
        
        # Filter recent data and format
        df = df[df['date'] >= pd.Timestamp('2023-10-01')]
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')
        
        # Create optimized structure by location
        truth_data = {}
        for location in df['location'].unique():
            loc_data = df[df['location'] == location]
            truth_data[location] = {
                'dates': loc_data['date'].tolist(),
                'values': loc_data['value'].tolist(),
                'rates': loc_data['weekly_rate'].tolist()
            }
        
        return truth_data

    def process_model_outputs(self) -> Dict:
        """Read and process model outputs into plotting-optimized format"""
        logger.info("Processing model outputs...")
        
        # Initialize structure
        plot_data = {
            'locations': {},
            'models': set(),
            'dates': set()
        }
        
        # Get list of model directories
        model_dirs = list(self.model_output_path.glob("*"))
        total_models = len(model_dirs)
        processed_count = 0
        
        # Process each model directory
        for model_dir in model_dirs:
            if not model_dir.is_dir():
                continue
                
            model_name = model_dir.name
            plot_data['models'].add(model_name)
            processed_count += 1
            logger.info(f"Processing model {processed_count}/{total_models}: {model_name}")
            
            # Process CSV and parquet files
            for file_path in model_dir.glob("*.csv"):
                self._process_forecast_file(file_path, model_name, plot_data)
            for file_path in model_dir.glob("*.parquet"):
                self._process_forecast_file(file_path, model_name, plot_data, is_parquet=True)
        
        # Convert sets to sorted lists for JSON serialization
        plot_data['models'] = sorted(list(plot_data['models']))
        plot_data['dates'] = sorted(list(plot_data['dates']))
        
        return plot_data

    def _process_forecast_file(self, file_path: Path, model_name: str, plot_data: Dict, is_parquet: bool = False):
        """Process individual forecast file and update plot data structure"""
        try:
            df = pd.read_parquet(file_path) if is_parquet else pd.read_csv(file_path)
            
            # Convert dates to consistent format
            df['reference_date'] = pd.to_datetime(df['reference_date']).dt.strftime('%Y-%m-%d')
            if 'target_end_date' in df.columns:
                df['target_end_date'] = pd.to_datetime(df['target_end_date']).dt.strftime('%Y-%m-%d')
            
            # Update available dates
            plot_data['dates'].update(df['reference_date'].unique())
            
            # Process each location
            for location in df['location'].unique():
                if location not in plot_data['locations']:
                    plot_data['locations'][location] = {
                        'reference_dates': {}
                    }
                
                loc_data = plot_data['locations'][location]
                
                # Process each reference date
                for ref_date, date_group in df[df['location'] == location].groupby('reference_date'):
                    if ref_date not in loc_data['reference_dates']:
                        loc_data['reference_dates'][ref_date] = {
                            'models': {}
                        }
                    
                    # Process model data for this date
                    model_data = self._extract_model_data(date_group, model_name)
                    if model_data:
                        loc_data['reference_dates'][ref_date]['models'][model_name] = model_data
                        
        except Exception as e:
            logger.error(f"Error processing {file_path}: {str(e)}")

    def _extract_model_data(self, group_df: pd.DataFrame, model_name: str) -> Dict:
        """Extract and format model predictions for plotting"""
        model_data = {}
        
        # Process quantile predictions
        quantile_df = group_df[group_df['output_type'] == 'quantile']
        if not quantile_df.empty:
            quantile_data = {}
            for target in self.targets:
                target_df = quantile_df[quantile_df['target'] == target]
                if not target_df.empty:
                    quantile_data[target] = self._format_quantile_data(target_df)
            if quantile_data:
                model_data['quantiles'] = quantile_data
        
        # Process PMF predictions
        pmf_df = group_df[group_df['output_type'] == 'pmf']
        if not pmf_df.empty:
            pmf_data = {}
            for target in self.targets:
                target_df = pmf_df[pmf_df['target'] == target]
                if not target_df.empty:
                    pmf_data[target] = self._format_pmf_data(target_df)
            if pmf_data:
                model_data['pmf'] = pmf_data
        
        return model_data

    def _format_quantile_data(self, df: pd.DataFrame) -> Dict:
        """Format quantile predictions for plotting"""
        horizons = {}
        
        for horizon, horizon_df in df.groupby('horizon'):
            # Filter to plot quantiles and sort
            horizon_df = horizon_df[horizon_df['output_type_id'].astype(float).isin(self.plot_quantiles)]
            horizon_df = horizon_df.sort_values('output_type_id')
            
            horizons[str(int(horizon))] = {
                'date': horizon_df['target_end_date'].iloc[0],
                'quantiles': horizon_df['output_type_id'].astype(float).tolist(),
                'values': horizon_df['value'].tolist()
            }
        
        return horizons

    def _format_pmf_data(self, df: pd.DataFrame) -> Dict:
        """Format PMF predictions for plotting"""
        horizons = {}
        
        for horizon, horizon_df in df.groupby('horizon'):
            horizon_df = horizon_df.sort_values('output_type_id')
            
            horizons[str(int(horizon))] = {
                'date': horizon_df['target_end_date'].iloc[0],
                'categories': horizon_df['output_type_id'].tolist(),
                'probabilities': horizon_df['value'].tolist()
            }
        
        return horizons

    def create_metadata(self) -> Dict:
        """Create metadata for the visualization"""
        try:
            locations_df = pd.read_csv(self.base_path / "auxiliary-data/locations.csv")
            location_metadata = {}
            
            for _, row in locations_df.iterrows():
                location_metadata[row['location']] = {
                    'name': row['location_name'],
                    'population': row['population']
                }
            
            return location_metadata
        except Exception as e:
            logger.error(f"Error creating metadata: {str(e)}")
            return {}

    def process_and_save(self):
        """Run full processing pipeline and save results"""
        try:
            # Read ground truth data
            truth_data = self.read_ground_truth()
            
            # Process model outputs
            plot_data = self.process_model_outputs()
            
            # Add metadata
            metadata = self.create_metadata()
            
            # Create final payload
            payload = {
                'metadata': {
                    'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'locations': metadata,
                    'available_dates': plot_data['dates'],
                    'available_models': plot_data['models']
                },
                'truth': truth_data,
                'forecasts': plot_data['locations']
            }
            
            # Save to JSON
            output_file = self.output_path / 'plot_data.json'
            with open(output_file, 'w') as f:
                json.dump(payload, f)
            
            logger.info(f"Saved plot data to {output_file}")
            
        except Exception as e:
            logger.error(f"Error in processing pipeline: {str(e)}")
            raise

def main():
    hub_path = os.getenv('FLUSIGHT_HUB_PATH', './FluSight-forecast-hub')
    output_path = os.getenv('OUTPUT_PATH', './processed_data')
    
    processor = FluSightPlotProcessor(hub_path, output_path)
    processor.process_and_save()

if __name__ == "__main__":
    main()
