import pandas as pd
import requests
import json
from pathlib import Path
import logging
from datetime import datetime
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NHSNDataDownloader:
    def __init__(self, output_path: str, base_path: str = "."):
        """Initialize the NHSN data downloader"""
        self.official_url = "https://data.cdc.gov/resource/ua7e-t2fy.json"
        self.preliminary_url = "https://data.cdc.gov/resource/mpgq-jmmr.json"
        self.output_path = Path(output_path)
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Add locations handling
        self.locations_path = Path(base_path) / "auxiliary-data/locations.csv"
        self.locations_data = None
        
    def download_data(self, batch_size: int = 1000) -> pd.DataFrame:
        """Download all NHSN data using pagination from both endpoints"""
        logger.info("Starting NHSN data download...")
        
        # Download from both endpoints
        official_data = self._download_from_endpoint(self.official_url, batch_size, "official")
        preliminary_data = self._download_from_endpoint(self.preliminary_url, batch_size, "preliminary")
        
        # Convert both to dataframes
        official_df = pd.DataFrame(official_data)
        preliminary_df = pd.DataFrame(preliminary_data)
        
        # Merge the dataframes, giving priority to official data
        df = pd.concat([preliminary_df, official_df]).drop_duplicates(
            subset=['jurisdiction', 'weekendingdate'], 
            keep='last'
        )
        
        return df
        
        return df
        
    def _download_from_endpoint(self, url: str, batch_size: int, data_type: str) -> list:
        """Download data from a specific endpoint"""
        all_data = []
        offset = 0
        
        while True:
            logger.info(f"Downloading {data_type} records {offset} to {offset + batch_size}")
            params = {
                "$limit": batch_size,
                "$offset": offset
            }
            
            try:
                response = requests.get(url, params=params)
                response.raise_for_status()
                batch_data = response.json()
                
                if not batch_data:  # No more data
                    break
                    
                all_data.extend(batch_data)
                offset += batch_size
                time.sleep(0.1)  # Rate limiting
                
            except Exception as e:
                logger.error(f"Error downloading {data_type} data: {str(e)}")
                break
                
        return all_data

    def load_locations(self) -> pd.DataFrame:
        """Load and cache locations data"""
        if self.locations_data is None:
            logger.info("Loading locations data...")
            self.locations_data = pd.read_csv(self.locations_path)
        return self.locations_data

    def process_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Process the downloaded data into the required format"""
        logger.info("Processing NHSN data...")
        
        # Load locations and create mapping
        locations = self.load_locations()
        location_map = dict(zip(locations['location_name'], locations['location']))
        
        # Map jurisdiction names to location codes
        df['jurisdiction'] = df['jurisdiction'].map(lambda x: location_map.get(x, x))
        
        # Rename key columns to match ground truth format
        df = df.rename(columns={
            'jurisdiction': 'location',
            'weekendingdate': 'date'
        })
        
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Convert all numeric columns
        numeric_columns = df.select_dtypes(include=['object']).columns
        for col in numeric_columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Sort data
        df = df.sort_values(['date', 'location'])
        
        return df
        
        return df

    def save_data(self, df: pd.DataFrame):
        """Save the processed data"""
        logger.info("Saving processed data...")
        
        # Create directory if it doesn't exist
        target_dir = self.output_path / "nhsn"
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Save full CSV with all columns
        df.to_csv(target_dir / "target-hospital-admissions.csv", index=False)
        
        # Create ground_truth.json with all numeric columns
        json_data = {}
        for location in df['location'].unique():
            loc_data = df[df['location'] == location].sort_values('date')
            
            # Only include locations that have data
            if not loc_data.empty:
                # Get all numeric columns
                numeric_cols = loc_data.select_dtypes(include=['number']).columns
                
                location_data = {
                    'dates': loc_data['date'].dt.strftime('%Y-%m-%d').tolist(),
                    'columns': list(numeric_cols),
                    'data': {}
                }
                
                # Add each numeric column's data
                for col in numeric_cols:
                    location_data['data'][col] = [float(v) if pd.notna(v) else None for v in loc_data[col].tolist()]
                
                json_data[location] = location_data
        
        # Save JSON
        with open(target_dir / "ground_truth.json", 'w') as f:
            json.dump(json_data, f, indent=2)

def main():
    """Main execution function"""
    output_path = "target-data/nhsn"
    base_path = "."  # Default to current directory
    
    try:
        downloader = NHSNDataDownloader(output_path, base_path)
        
        # Download data
        df = downloader.download_data()
        
        # Process data
        processed_df = downloader.process_data(df)
        
        # Save data
        downloader.save_data(processed_df)
        
        logger.info("NHSN data download and processing complete!")
        
    except Exception as e:
        logger.error(f"Failed to download and process NHSN data: {str(e)}")
        raise

if __name__ == "__main__":
    main()
