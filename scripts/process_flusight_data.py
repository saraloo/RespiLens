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
        
    def validate_and_plot_payload(self, payload, location):
        """Generate validation plots for a single location's payload with multiple model support"""
        pdf_path = self.output_path / f"{location}_validation.pdf"
        
        # Initialize validation plotter
        self.plotter = ValidationPlotter(self.output_path)
        
        with PdfPages(pdf_path) as pdf:
            # Create figure with a grid layout
            fig = plt.figure(figsize=(16, 12))
            gs = plt.GridSpec(2, 2, height_ratios=[2, 1])
            
            # Create main time series plot
            ax_ts = fig.add_subplot(gs[0, :])  # Top panel spans both columns
            ax_hist = fig.add_subplot(gs[1, 0])  # Bottom left panel for histogram
            ax_quant = fig.add_subplot(gs[1, 1])  # Bottom right panel for quantile comparison
            
            # Process ground truth data
            gt_dates = pd.to_datetime(payload['ground_truth']['dates'])
            gt_values = np.array(payload['ground_truth']['values'])
            
            # Sort ground truth data by date
            sort_idx = np.argsort(gt_dates)
            gt_dates = gt_dates[sort_idx]
            gt_values = gt_values[sort_idx]
            
            # Plot ground truth data with gaps
            self._plot_ground_truth(ax_ts, gt_dates, gt_values)
            
            # Get all reference dates from the payload
            reference_dates = list(payload['forecasts'].keys())
            current_ref_date = max(reference_dates) if reference_dates else None
            
            if current_ref_date:
                ref_date_data = payload['forecasts'][current_ref_date]
                
                # Plot incidence forecasts for each model
                if 'wk inc flu hosp' in ref_date_data:
                    for model_name, model_data in ref_date_data['wk inc flu hosp']['models'].items():
                        color = model_colors.get(model_name, default_color)
                        if model_data['type'] == 'quantile':
                            self._plot_quantile_forecast(ax_ts, model_data, model_name, color)
                
                # Plot rate change categorical forecasts
                if 'wk flu hosp rate change' in ref_date_data:
                    self._plot_rate_change_histogram(
                        ax_hist, 
                        ref_date_data['wk flu hosp rate change']['models'],
                        model_colors,
                        default_color
                    )
                
                # Plot quantile comparisons
                if 'wk inc flu hosp' in ref_date_data:
                    self._plot_model_quantile_comparison(
                        ax_quant,
                        ref_date_data['wk inc flu hosp']['models'],
                        model_colors,
                        default_color
                    )
            
            # Format plots
            self._format_time_series_plot(ax_ts, location, gt_dates, gt_values)
            self._format_histogram_plot(ax_hist)
            self._format_quantile_plot(ax_quant)
            
            # Save the figure
            try:
                plt.tight_layout()
                pdf.savefig(fig, bbox_inches='tight')
            except Exception as e:
                logger.error(f"Error saving figure for {location}: {str(e)}")
            finally:
                plt.close(fig)

    def _plot_ground_truth(self, ax, dates, values):
        """Plot ground truth data with gap detection"""
        date_diffs = np.diff(dates)
        date_diffs_days = date_diffs / np.timedelta64(1, 'D')
        gap_indices = np.where(date_diffs_days > 7)[0]
        
        start_idx = 0
        for end_idx in gap_indices:
            segment_dates = dates[start_idx:end_idx + 1]
            segment_values = values[start_idx:end_idx + 1]
            if len(segment_dates) > 0:
                ax.plot(segment_dates, segment_values, color='black', 
                        marker='.', linewidth=2, label='Ground Truth' if start_idx == 0 else None)
            start_idx = end_idx + 1
        
        if start_idx < len(dates):
            segment_dates = dates[start_idx:]
            segment_values = values[start_idx:]
            if len(segment_dates) > 0:
                ax.plot(segment_dates, segment_values, color='black', 
                        marker='.', linewidth=2, label='Ground Truth' if start_idx == 0 else None)

    def _plot_quantile_forecast(self, ax, model_data, model_name, color):
        """Plot quantile forecasts for a single model"""
        try:
            dates, medians, ci95_lower, ci95_upper, ci50_lower, ci50_upper = [], [], [], [], [], []
            quantile_indices = {
                0.025: 0,
                0.25: 1,
                0.5: 2,
                0.75: 3,
                0.975: 4
            }
            
            for horizon, data in model_data['horizons'].items():
                forecast_date = pd.to_datetime(data['date'])
                if len(data['values']) >= 5:
                    dates.append(forecast_date)
                    ci95_lower.append(data['values'][quantile_indices[0.025]])
                    ci50_lower.append(data['values'][quantile_indices[0.25]])
                    medians.append(data['values'][quantile_indices[0.5]])
                    ci50_upper.append(data['values'][quantile_indices[0.75]])
                    ci95_upper.append(data['values'][quantile_indices[0.975]])
            
            if dates:
                ax.plot(dates, medians, color=color, marker='.', 
                        label=f'{model_name} Median')
                ax.fill_between(dates, ci95_lower, ci95_upper, alpha=0.2, 
                            color=color, label=f'{model_name} 95% CI')
                ax.fill_between(dates, ci50_lower, ci50_upper, alpha=0.3, 
                            color=color, label=f'{model_name} 50% CI')
        except Exception as e:
            logger.warning(f"Error plotting quantile forecast for {model_name}: {str(e)}")

    def _plot_rate_change_histogram(self, ax, models_data, model_colors, default_color):
        """Plot rate change categorical forecasts for multiple models"""
        category_order = ['large_decrease', 'decrease', 'stable', 'increase', 'large_increase']
        bar_width = 0.8 / len(models_data)  # Adjust bar width based on number of models
        bar_positions = np.arange(len(category_order))
        
        for idx, (model_name, model_data) in enumerate(models_data.items()):
            try:
                if model_data['type'] == 'pmf':
                    horizon_data = model_data['horizons'].get('0', {})
                    if horizon_data:
                        categories = horizon_data.get('categories', [])
                        values = horizon_data.get('values', [])
                        
                        cat_values = dict(zip(categories, values))
                        plot_values = [cat_values.get(cat, 0) for cat in category_order]
                        
                        offset = bar_width * (idx - len(models_data)/2 + 0.5)
                        color = model_colors.get(model_name, default_color)
                        bars = ax.bar(bar_positions + offset, plot_values, 
                                    bar_width, label=model_name, color=color, alpha=0.7)
                        
                        # Add value labels
                        for bar, value in zip(bars, plot_values):
                            if value > 0.05:  # Only label bars with significant probability
                                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height(),
                                    f'{value:.2f}', ha='center', va='bottom', rotation=45)
            except Exception as e:
                logger.warning(f"Error plotting rate change histogram for {model_name}: {str(e)}")

    def _plot_model_quantile_comparison(self, ax, models_data, model_colors, default_color):
        """Plot quantile comparison for multiple models"""
        quantiles = [0.025, 0.25, 0.5, 0.75, 0.975]
        
        for model_name, model_data in models_data.items():
            try:
                if model_data['type'] == 'quantile':
                    horizon_data = model_data['horizons'].get('0', {})
                    if horizon_data and len(horizon_data['values']) >= 5:
                        color = model_colors.get(model_name, default_color)
                        ax.plot(quantiles, horizon_data['values'][:5], 'o-', 
                            color=color, label=model_name)
            except Exception as e:
                logger.warning(f"Error plotting quantile comparison for {model_name}: {str(e)}")

    def _format_time_series_plot(self, ax, location, gt_dates, gt_values):
        """Format the time series plot"""
        if len(gt_dates) > 0:
            ax.set_xlim(gt_dates.min(), gt_dates.max())
            valid_values = gt_values[~np.isnan(gt_values)]
            if len(valid_values) > 0:
                y_max = np.percentile(valid_values, 99)
                ax.set_ylim(0, y_max * 1.1)
        
        ax.set_title(f"{location} - Hospitalization Forecast")
        ax.set_xlabel('Date')
        ax.set_ylabel('Hospitalizations')
        ax.tick_params(axis='x', rotation=45)
        ax.grid(True, alpha=0.3)
        
        # Adjust legend
        handles, labels = ax.get_legend_handles_labels()
        by_label = dict(zip(labels, handles))
        ax.legend(by_label.values(), by_label.keys(), loc='upper left')

    def _format_histogram_plot(self, ax):
        """Format the histogram plot"""
        ax.set_title('Rate Change Categories (Current Week)')
        ax.set_xlabel('Category')
        ax.set_ylabel('Probability')
        category_order = ['large_decrease', 'decrease', 'stable', 'increase', 'large_increase']
        ax.set_xticks(np.arange(len(category_order)))
        ax.set_xticklabels(category_order, rotation=45)
        ax.grid(True, axis='y', alpha=0.3)
        ax.legend()

    def _format_quantile_plot(self, ax):
        """Format the quantile comparison plot"""
        ax.set_title('Quantile Comparison (Current Week)')
        ax.set_xlabel('Quantile')
        ax.set_ylabel('Hospitalizations')
        ax.grid(True, alpha=0.3)
        ax.legend()

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
