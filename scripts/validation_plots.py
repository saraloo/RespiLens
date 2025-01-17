import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
import logging

logger = logging.getLogger(__name__)

class ValidationPlotter:
    def __init__(self, output_path):
        self.output_path = output_path
        
        # Define a color palette for different models
        self.model_colors = {
            'FluSight-ensemble': '#1f77b4',  # blue
            'UMass-hosp': '#2ca02c',         # green
            'CovidHub-baseline': '#ff7f0e',   # orange
            'CDC-baseline': '#d62728'         # red
        }
        # Default color for models not in the palette
        self.default_color = '#7f7f7f'  # gray

    def generate_validation_plots(self, payload, location):
        """Generate validation plots for a single location's payload"""
        pdf_path = self.output_path / f"{location}_validation.pdf"
        
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
                
                # Plot incidence forecasts only for FluSight-ensemble
                if 'wk inc flu hosp' in ref_date_data:
                    model_data = ref_date_data['wk inc flu hosp']['models'].get('FluSight-ensemble')
                    if model_data and model_data['type'] == 'quantile':
                        color = self.model_colors.get('FluSight-ensemble', self.default_color)
                        self._plot_quantile_forecast(ax_ts, model_data, 'FluSight-ensemble', color)
                
                # Plot rate change categorical forecasts only for FluSight-ensemble
                if 'wk flu hosp rate change' in ref_date_data:
                    model_data = ref_date_data['wk flu hosp rate change']['models'].get('FluSight-ensemble')
                    if model_data:
                        self._plot_rate_change_histogram(
                            ax_hist, 
                            {'FluSight-ensemble': model_data},
                            self.model_colors,
                            self.default_color
                        )
                
                # Plot quantile comparisons only for FluSight-ensemble
                if 'wk inc flu hosp' in ref_date_data:
                    model_data = ref_date_data['wk inc flu hosp']['models'].get('FluSight-ensemble')
                    if model_data:
                        self._plot_model_quantile_comparison(
                            ax_quant,
                            {'FluSight-ensemble': model_data},
                            self.model_colors,
                            self.default_color
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
