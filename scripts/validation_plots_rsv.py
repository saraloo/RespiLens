import os
import json
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.dates import AutoDateLocator, DateFormatter
import numpy as np
import pandas as pd
import argparse
import logging
from tqdm import tqdm
from typing import Dict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RSVValidator:
    def __init__(self, data_dir: str, output_dir: str):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Target dates for visualization 
        self.target_dates = ['2024-01-15', '2024-12-15']
        self.model_name = 'hub-ensemble'  # This matches actual model name in data
        
        # Age groups to show
        self.age_groups = ["0-0.49", "0.5-0.99", "1-1.99", "2-4"]
        
        # Colors for different forecasts
        self.colors = {
            'groundtruth': '#000000',
            self.target_dates[0]: '#1f77b4',  # First target date - blue
            self.target_dates[1]: '#ff7f0e'   # Second target date - orange
        }

    def plot_location_validation(self, location: str, payload: Dict):
        """Create validation plots for a single location"""
        try:
            # Add debug logging
            logger.info(f"\nPayload structure for {location}:")
            logger.info(f"Full payload keys: {list(payload.keys())}")
            logger.info(f"Ground truth structure: {json.dumps(payload['ground_truth'], indent=2)}")
            logger.info(f"Forecast dates: {list(payload['forecasts'].keys())}")
            
            # Add ground truth data logging
            if payload['ground_truth']:
                for age_group in self.age_groups:
                    if age_group in payload['ground_truth']:
                        logger.info(f"Age group {age_group} has {len(payload['ground_truth'][age_group]['values'])} data points")
                        logger.info(f"Sample values: {payload['ground_truth'][age_group]['values'][:5]}")
            
            # Create figure with subplots for each age group - 2x2 grid
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            fig.suptitle(f"RSV Validation Plot - {payload['metadata']['location_name']} ({location})")
            axes = axes.ravel()  # Flatten axes array for easier indexing

            # Plot each age group
            for idx, age_group in enumerate(self.age_groups):
                ax = axes[idx]
                
                # Plot ground truth if available and has data
                if age_group in payload['ground_truth']:
                    logger.info(f"\nProcessing {age_group} ground truth:")
                    gt_data = payload['ground_truth'][age_group]
                    logger.info(f"Ground truth data: {json.dumps(gt_data, indent=2)}")
                    
                    if gt_data and 'dates' in gt_data and 'values' in gt_data:
                        dates = pd.to_datetime(gt_data['dates'])
                        values = np.array(gt_data['values'])
                        
                        logger.info(f"Raw dates: {dates}")
                        logger.info(f"Raw values: {values}")
                        
                        # Ensure we don't have any string 'null' or None values
                        valid_mask = pd.notna(values) & (values != 'null')
                        dates = dates[valid_mask]
                        values = values[valid_mask].astype(float)
                        
                        logger.info(f"After cleaning - dates: {dates}")
                        logger.info(f"After cleaning - values: {values}")
                        
                        # Sort data by date to ensure proper line plotting
                        sort_idx = np.argsort(dates)
                        dates = dates[sort_idx]
                        values = values[sort_idx]
                        
                        if len(dates) > 0 and len(values) > 0:
                            ax.plot(dates, values, color=self.colors['groundtruth'], 
                                   label='Ground Truth', linewidth=1)
                            logger.info("Successfully plotted ground truth")
                            logger.info(f"Date range: {min(dates)} to {max(dates)}")
                            logger.info(f"Value range: {min(values)} to {max(values)}")
                        else:
                            logger.warning(f"No valid data points after cleaning for {age_group}")
                    else:
                        logger.warning(f"Missing dates or values in ground truth for {location} age group {age_group}")
                else:
                    logger.info(f"No ground truth data found for {location} age group {age_group}")

                # Find available dates for forecasts
                available_dates = []
                for date in payload['forecasts'].keys():
                    if age_group in payload['forecasts'][date]:
                        available_dates.append(date)
                available_dates = sorted(available_dates)

                # Find closest dates to targets
                plot_dates = self.find_closest_dates(available_dates, self.target_dates)
                
                # Plot each forecast date
                for target_date, actual_date in zip(self.target_dates, plot_dates):
                    if actual_date in payload['forecasts'] and age_group in payload['forecasts'][actual_date]:
                        self._plot_forecast(ax, payload['forecasts'][actual_date][age_group], 
                                         actual_date, target_date)

                ax.set_title(f'Age Group: {age_group}')
                ax.set_xlabel('Date')
                ax.set_ylabel('Hospitalizations')
                ax.grid(True, alpha=0.3)
                ax.legend()
                
                # Format x-axis to show dates nicely
                ax.xaxis.set_major_locator(AutoDateLocator())
                ax.xaxis.set_major_formatter(DateFormatter('%Y-%m-%d'))
                plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')

            plt.tight_layout()
            
            # Save plot
            pdf_path = self.output_dir / f"{location}_rsv_validation.pdf"
            plt.savefig(pdf_path, bbox_inches='tight')
            plt.close()

        except Exception as e:
            logger.error(f"Error creating plots for {location}: {str(e)}")
            plt.close()

    def find_closest_dates(self, available_dates: list, target_dates: list) -> list:
        """Find the closest available dates to the target dates"""
        available_dates = pd.to_datetime(available_dates)
        target_dates = pd.to_datetime(target_dates)
        closest_dates = []
        
        for target in target_dates:
            if len(available_dates) == 0:
                continue
            time_diff = abs(available_dates - target)
            closest_idx = time_diff.argmin()
            closest_dates.append(available_dates[closest_idx].strftime('%Y-%m-%d'))
            
        return closest_dates

    def _plot_forecast(self, ax, age_forecasts: Dict, actual_date: str, target_date: str):
        """Plot quantile forecasts for a specific age group"""
        try:
            if 'inc hosp' not in age_forecasts:
                return
                
            model_data = age_forecasts['inc hosp'].get(self.model_name)
            if not model_data or model_data['type'] != 'quantile':
                return

            color = self.colors[target_date]
            
            dates = []
            medians = []
            q50_lower = []
            q50_upper = []
            q95_lower = []
            q95_upper = []
            
            horizons = sorted(model_data['predictions'].keys(), key=int)
            
            for horizon in horizons:
                pred = model_data['predictions'][horizon]
                dates.append(pd.to_datetime(actual_date) + pd.Timedelta(days=int(horizon)*7))
                
                quantiles = np.array(pred['quantiles'])
                values = np.array(pred['values'])
                
                # Extract quantile values
                median_idx = np.where(quantiles == 0.5)[0][0]
                q50_lower_idx = np.where(quantiles == 0.25)[0][0]
                q50_upper_idx = np.where(quantiles == 0.75)[0][0]
                q95_lower_idx = np.where(quantiles == 0.025)[0][0]
                q95_upper_idx = np.where(quantiles == 0.975)[0][0]
                
                medians.append(values[median_idx])
                q50_lower.append(values[q50_lower_idx])
                q50_upper.append(values[q50_upper_idx])
                q95_lower.append(values[q95_lower_idx])
                q95_upper.append(values[q95_upper_idx])
            
            # Plot intervals
            ax.fill_between(dates, q95_lower, q95_upper, color=color, alpha=0.2)
            ax.fill_between(dates, q50_lower, q50_upper, color=color, alpha=0.4)
            
            # Plot median line
            ax.plot(dates, medians, '-', color=color, label=f'Forecast {actual_date}', linewidth=2)
            ax.plot(dates[0], medians[0], 'o', color=color)

        except Exception as e:
            logger.error(f"Error plotting forecast: {str(e)}")

    def validate_all_locations(self):
        """Create validation plots for all locations"""
        try:
            # Read metadata
            with open(self.data_dir / 'metadata.json', 'r') as f:
                metadata = json.load(f)

            # Process each location
            for loc_info in tqdm(metadata['locations'], desc="Creating validation plots"):
                try:
                    # Check if payload file exists before attempting to read it
                    location = loc_info['abbreviation']
                    payload_path = self.data_dir / f"{location}_rsv.json"
                    
                    if not payload_path.exists():
                        logger.info(f"Skipping {location} - no payload file found")
                        continue
                        
                    with open(payload_path, 'r') as f:
                        payload = json.load(f)

                    # Check if there are any forecasts
                    if not payload['forecasts']:
                        logger.info(f"Skipping {location} - no forecast data")
                        continue

                    # Create validation plots only if we have data
                    self.plot_location_validation(location, payload)
                    
                except Exception as e:
                    logger.error(f"Error processing location {location}: {str(e)}")
                    continue

        except Exception as e:
            logger.error(f"Error in validate_all_locations: {str(e)}")
            raise

def main():
    parser = argparse.ArgumentParser(description='Validate RSV visualization payloads')
    parser.add_argument('--data-dir', type=str, required=True,
                      help='Directory containing processed RSV JSON payloads')
    parser.add_argument('--output-dir', type=str, required=True,
                      help='Directory for validation PDF outputs')
    
    args = parser.parse_args()
    
    try:
        validator = RSVValidator(args.data_dir, args.output_dir)
        validator.validate_all_locations()
        logger.info("Validation complete!")
        
    except Exception as e:
        logger.error(f"Failed to run validation: {str(e)}")
        raise

if __name__ == "__main__":
    main()
