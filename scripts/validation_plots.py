import os
import json
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.backends.backend_pdf import PdfPages
import argparse
from typing import Dict, Tuple, Optional
import logging
from tqdm import tqdm

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FluSightValidator:
    def __init__(self, data_dir: str, output_dir: str):
        """Initialize validator with data and output directories"""
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Target dates for visualization
        self.target_dates = ['2024-01-15', '2024-12-15']
        self.model_name = 'FluSight-ensemble'
        
        # Color schemes for each target date
        self.colors = {
            'groundtruth': '#000000',
            self.target_dates[0]: '#1f77b4',  # First target date - blue
            self.target_dates[1]: '#ff7f0e'   # Second target date - orange
        }
        
        # Category order
        self.category_order = [
            'large_decrease',
            'decrease',
            'stable',
            'increase',
            'large_increase'
        ]

    def find_closest_dates(self, available_dates: list, target_dates: list) -> list:
        """Find the closest available dates to the target dates"""
        available_dates = pd.to_datetime(available_dates)
        target_dates = pd.to_datetime(target_dates)
        closest_dates = []
        
        for target in target_dates:
            time_diff = abs(available_dates - target)
            closest_idx = time_diff.argmin()
            closest_dates.append(available_dates[closest_idx].strftime('%Y-%m-%d'))
            
        return closest_dates

    def plot_location_validation(self, location: str, payload: Dict):
        """Create validation plots for a single location"""
        try:
            # Create figure with two subplots
            fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10), height_ratios=[2, 1])
            fig.suptitle(f"Validation Plot - {payload['metadata']['location_name']} ({location})")

            # Plot ground truth data
            dates = pd.to_datetime(payload['ground_truth']['dates'])
            values = payload['ground_truth']['values']
            ax1.plot(dates, values, color=self.colors['groundtruth'], 
                    label='Ground Truth', linewidth=1)

            # Find closest dates to targets in the forecasts
            available_dates = sorted(list(payload['forecasts'].keys()))
            plot_dates = self.find_closest_dates(available_dates, self.target_dates)
            
            # Plot projections and categories for each date
            for target_date, actual_date in zip(self.target_dates, plot_dates):
                if actual_date in payload['forecasts']:
                    self._plot_forecast(ax1, payload['forecasts'][actual_date], actual_date, target_date)
                    self._add_categories(ax2, payload['forecasts'][actual_date], actual_date, target_date)

            # Customize time series plot
            ax1.set_title('Time Series with Forecasts')
            ax1.set_xlabel('Date')
            ax1.set_ylabel('Hospitalizations')
            ax1.grid(True, alpha=0.3)
            ax1.legend()

            # Customize categories plot
            ax2.set_title('Rate Change Categories')
            ax2.set_xlabel('Categories')
            ax2.set_ylabel('Probability')
            ax2.grid(True, alpha=0.3)
            ax2.legend()
            
            # Ensure y-axis starts at 0 for probabilities
            ax2.set_ylim(0, 1.0)

            # Adjust layout
            plt.tight_layout()
            
            # Save plot
            pdf_path = self.output_dir / f"{location}_validation.pdf"
            plt.savefig(pdf_path, bbox_inches='tight')
            plt.close()

        except Exception as e:
            logger.error(f"Error creating plots for {location}: {str(e)}")
            plt.close()

    def _plot_forecast(self, ax, date_forecasts: Dict, actual_date: str, target_date: str):
        """Plot quantile forecasts as continuous time series"""
        try:
            if 'wk inc flu hosp' not in date_forecasts:
                return
                
            model_data = date_forecasts['wk inc flu hosp'].get(self.model_name)
            if not model_data or model_data['type'] != 'quantile':
                return

            color = self.colors[target_date]
            
            # Collect all dates and values across horizons
            dates = []
            medians = []
            q50_lower = []
            q50_upper = []
            q95_lower = []
            q95_upper = []
            
            # Sort horizons to ensure correct ordering
            horizons = sorted(model_data['predictions'].keys(), key=int)
            
            for horizon in horizons:
                pred = model_data['predictions'][horizon]
                pred_date = pd.to_datetime(pred['date'])
                dates.append(pred_date)
                
                quantiles = np.array(pred['quantiles'])
                values = np.array(pred['values'])
                
                # Find indices for different quantiles
                median_idx = np.where(quantiles == 0.5)[0][0]
                q50_lower_idx = np.where(quantiles == 0.25)[0][0]
                q50_upper_idx = np.where(quantiles == 0.75)[0][0]
                q95_lower_idx = np.where(quantiles == 0.025)[0][0]
                q95_upper_idx = np.where(quantiles == 0.975)[0][0]
                
                # Collect values
                medians.append(values[median_idx])
                q50_lower.append(values[q50_lower_idx])
                q50_upper.append(values[q50_upper_idx])
                q95_lower.append(values[q95_lower_idx])
                q95_upper.append(values[q95_upper_idx])
            
            # Plot 95% interval with lighter shade
            ax.fill_between(dates, q95_lower, q95_upper, 
                          color=color, alpha=0.2)
            
            # Plot 50% interval with darker shade
            ax.fill_between(dates, q50_lower, q50_upper, 
                          color=color, alpha=0.4)
            
            # Plot median line
            line = ax.plot(dates, medians, '-', color=color, 
                         label=f'Forecast {actual_date}', linewidth=2)
            # Add dot at horizon 0 for visual reference
            ax.plot(dates[0], medians[0], 'o', color=color)

        except Exception as e:
            logger.error(f"Error plotting forecast for date {actual_date}: {str(e)}")

    def _add_categories(self, ax, date_forecasts: Dict, actual_date: str, target_date: str):
        """Plot categorical forecasts for a specific date"""
        try:
            if 'wk flu hosp rate change' not in date_forecasts:
                return
                
            model_data = date_forecasts['wk flu hosp rate change'].get(self.model_name)
            if not model_data or model_data['type'] != 'pmf':
                return

            # Get predictions for horizon 0 (current week)
            pred = model_data['predictions'].get('0')
            if not pred:
                return

            # Reorder probabilities to match logical order
            probabilities = []
            for cat in self.category_order:
                idx = pred['categories'].index(cat)
                probabilities.append(pred['probabilities'][idx])

            # Set bar positions - all categories side by side
            x_pos = np.arange(len(self.category_order))
            width = 0.35  # narrower bars to fit side by side
            
            # Offset based on which target date we're plotting
            offset = -width/2 if target_date == self.target_dates[0] else width/2
            
            # Create bars
            bars = ax.bar(x_pos + offset, probabilities, width,
                         label=f'Forecast {actual_date}',
                         color=self.colors[target_date],
                         alpha=0.7)

            # Add value labels on top of bars
            for i, prob in enumerate(probabilities):
                ax.text(x_pos[i] + offset, prob, f'{prob:.2f}',
                       ha='center', va='bottom', fontsize=8)

            # Set x-axis labels - only need to do this once
            if target_date == self.target_dates[0]:
                ax.set_xticks(x_pos)
                ax.set_xticklabels(self.category_order, rotation=45)

        except Exception as e:
            logger.error(f"Error plotting categories for date {actual_date}: {str(e)}")

    def validate_all_locations(self):
        """Create validation plots for all locations"""
        try:
            # Read metadata
            with open(self.data_dir / 'metadata.json', 'r') as f:
                metadata = json.load(f)

            # Process each location
            for location in tqdm(metadata['locations'], desc="Creating validation plots"):
                try:
                    # Read location payload
                    with open(self.data_dir / f"{location}.json", 'r') as f:
                        payload = json.load(f)
                    
                    # Create validation plots
                    self.plot_location_validation(location, payload)
                    
                except Exception as e:
                    logger.error(f"Error processing location {location}: {str(e)}")
                    continue

        except Exception as e:
            logger.error(f"Error in validate_all_locations: {str(e)}")
            raise

def main():
    parser = argparse.ArgumentParser(description='Validate FluSight visualization payloads')
    parser.add_argument('--data-dir', type=str, required=True,
                      help='Directory containing processed JSON payloads')
    parser.add_argument('--output-dir', type=str, required=True,
                      help='Directory for validation PDF outputs')
    parser.add_argument('--log-level', type=str, default='INFO',
                      choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                      help='Set logging level')
    
    args = parser.parse_args()
    
    # Set logging level
    logging.getLogger().setLevel(args.log_level)
    
    try:
        logger.info(f"Starting validation with data dir: {args.data_dir}")
        logger.info(f"Output dir: {args.output_dir}")
        
        validator = FluSightValidator(args.data_dir, args.output_dir)
        validator.validate_all_locations()
        
        logger.info("Validation complete!")
        
    except Exception as e:
        logger.error(f"Failed to run validation: {str(e)}")
        raise

if __name__ == "__main__":
    main()