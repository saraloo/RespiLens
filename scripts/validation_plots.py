import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ValidationPlotter:
    def __init__(self, output_path):
        self.output_path = Path(output_path)
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Color scheme for the two models we'll compare
        self.model_colors = {
            'UNC_IDD-influpaint': '#2ca02c',  # green
            'FluSight-ensemble': '#1f77b4'     # blue
        }
        
    def generate_validation_plots(self, payload, location):
        """Generate validation plots for a single location"""
        pdf_path = self.output_path / f"{location}_validation.pdf"
        
        with PdfPages(pdf_path) as pdf:
            # Create figure with two subplots
            fig, (ax_ts, ax_hist) = plt.subplots(2, 1, figsize=(12, 12), height_ratios=[2, 1])
            
            # Process ground truth data
            gt_dates = pd.to_datetime(payload['ground_truth']['dates'])
            gt_values = np.array(payload['ground_truth']['values'])
            
            # Sort ground truth data
            sort_idx = np.argsort(gt_dates)
            gt_dates = gt_dates[sort_idx]
            gt_values = gt_values[sort_idx]
            
            # Plot ground truth
            ax_ts.plot(gt_dates, gt_values, color='black', marker='.', 
                      linewidth=1, label='Ground Truth', alpha=0.7)
            
            # Get latest reference date
            reference_dates = sorted(payload['forecasts'].keys())
            if not reference_dates:
                logger.warning(f"No forecast data found for {location}")
                return
                
            current_ref_date = reference_dates[-1]
            ref_date_data = payload['forecasts'][current_ref_date]
            
            # Plot incidence forecasts for both models
            if 'wk inc flu hosp' in ref_date_data:
                for model_name in ['UNC_IDD-influpaint', 'FluSight-ensemble']:
                    model_data = ref_date_data['wk inc flu hosp']['models'].get(model_name)
                    if model_data and 'quantiles' in model_data:
                        self._plot_forecast(ax_ts, model_data, model_name)
            
            # Plot rate change categorical forecasts
            if 'wk flu hosp rate change' in ref_date_data:
                self._plot_rate_change_histogram(
                    ax_hist,
                    {model: ref_date_data['wk flu hosp rate change']['models'].get(model)
                     for model in ['UNC_IDD-influpaint', 'FluSight-ensemble']
                     if ref_date_data['wk flu hosp rate change']['models'].get(model)}
                )
            
            # Format plots
            self._format_time_series_plot(ax_ts, location, gt_dates, gt_values)
            self._format_histogram_plot(ax_hist)
            
            # Adjust layout and save
            plt.tight_layout()
            pdf.savefig(fig, bbox_inches='tight')
            plt.close(fig)
    
    def _plot_forecast(self, ax, model_data, model_name):
        """Plot quantile forecasts for a single model"""
        try:
            horizons = model_data['quantiles']
            dates, medians, ci95_lower, ci95_upper = [], [], [], []
            
            for horizon, data in horizons.items():
                forecast_date = pd.to_datetime(data['date'])
                quantiles = np.array(data['quantiles'])
                values = np.array(data['values'])
                
                # Get indices for required quantiles
                median_idx = np.abs(quantiles - 0.5).argmin()
                lower_idx = np.abs(quantiles - 0.025).argmin()
                upper_idx = np.abs(quantiles - 0.975).argmin()
                
                dates.append(forecast_date)
                medians.append(values[median_idx])
                ci95_lower.append(values[lower_idx])
                ci95_upper.append(values[upper_idx])
            
            color = self.model_colors.get(model_name, '#7f7f7f')
            ax.plot(dates, medians, color=color, marker='o', markersize=4,
                   label=f'{model_name} Median')
            ax.fill_between(dates, ci95_lower, ci95_upper, alpha=0.2,
                          color=color, label=f'{model_name} 95% CI')
            
        except Exception as e:
            logger.warning(f"Error plotting forecast for {model_name}: {str(e)}")
    
    def _plot_rate_change_histogram(self, ax, models_data):
        """Plot rate change categorical forecasts"""
        categories = ['large_decrease', 'decrease', 'stable', 'increase', 'large_increase']
        x = np.arange(len(categories))
        width = 0.35  # Width of bars
        
        for i, (model_name, model_data) in enumerate(models_data.items()):
            try:
                if model_data and 'pmf' in model_data:
                    horizon_data = model_data['pmf'].get('0', {})  # Get current week
                    if horizon_data:
                        # Create mapping of categories to probabilities
                        probs = {cat: 0.0 for cat in categories}
                        for cat, prob in zip(horizon_data['categories'], 
                                           horizon_data['probabilities']):
                            probs[cat] = prob
                        
                        # Plot bars
                        values = [probs[cat] for cat in categories]
                        offset = width * (i - 0.5)
                        bars = ax.bar(x + offset, values, width,
                                    label=model_name,
                                    color=self.model_colors.get(model_name),
                                    alpha=0.7)
                        
                        # Add value labels
                        for bar, value in zip(bars, values):
                            if value > 0.05:  # Only label significant probabilities
                                ax.text(bar.get_x() + bar.get_width()/2,
                                      bar.get_height(),
                                      f'{value:.2f}',
                                      ha='center', va='bottom',
                                      rotation=45)
                                
            except Exception as e:
                logger.warning(f"Error plotting histogram for {model_name}: {str(e)}")
    
    def _format_time_series_plot(self, ax, location, gt_dates, gt_values):
        """Format the time series plot"""
        # Set title and labels
        ax.set_title(f"Hospitalization Forecasts - {location}")
        ax.set_xlabel('Date')
        ax.set_ylabel('Weekly Hospitalizations')
        
        # Set axis limits
        if len(gt_dates) > 0:
            ax.set_xlim(gt_dates.min(), gt_dates.max())
            valid_values = gt_values[~np.isnan(gt_values)]
            if len(valid_values) > 0:
                y_max = np.percentile(valid_values, 99)
                ax.set_ylim(0, y_max * 1.2)
        
        # Format ticks and grid
        ax.tick_params(axis='x', rotation=45)
        ax.grid(True, alpha=0.3)
        
        # Adjust legend
        ax.legend(loc='upper left')
    
    def _format_histogram_plot(self, ax):
        """Format the categorical histogram plot"""
        ax.set_title('Rate Change Forecast - Current Week')
        ax.set_xlabel('Category')
        ax.set_ylabel('Probability')
        
        # Set x-ticks
        categories = ['large_decrease', 'decrease', 'stable', 'increase', 'large_increase']
        ax.set_xticks(np.arange(len(categories)))
        ax.set_xticklabels(categories, rotation=45)
        
        # Set y-axis limits and grid
        ax.set_ylim(0, 1.0)
        ax.grid(True, axis='y', alpha=0.3)
        
        # Adjust legend
        ax.legend()

def main():
    # Example usage
    plot_path = Path("./validation_plots")
    plotter = ValidationPlotter(plot_path)
    
    # Load your payload and generate plots
    # plotter.generate_validation_plots(payload, "US")

if __name__ == "__main__":
    main()