"""
module-level docs
"""

import json
import logging
import time
from pathlib import Path

import pandas as pd
import requests


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CDCData:
    
    def __init__(self, resource_id: str):
        """
        Initialize the CDCData class.
        
        Args:
            resource_id: The unique resource identifier string.
        """
        self.data_url = "https://data.cdc.gov/resource/" + f"{resource_id}.json"
        self.metadata_url = "https://data.cdc.gov/api/views/" + f"{resource_id}.json"
    
    def download_cdc_data(self, replace_column_names: bool = True, get_raw_json: bool = False) -> dict: # return dict with df or json of data and dict of metadata info
        """
        Retrieves and stores data + metadata for specified resource_id.
        
        Arg:
            replace_column_names: Flag to replace short column names with long names.
            get_raw_json: Flag to return a raw json of the data (instead of a pd.DataFrame)
        
        Returns:
            If get_raw_json = False, a dictionary with;
                'data' storing data as a pd.Dataframe, and
                'metadata' storing metadata as a dictionary of raw json.
            If get_raw_json = True, a dictionary with; 
                'data' storing the data as a dictionary of raw json, and
                'metadata' storing the metadata as a dictionary of raw json.
        """
        
        # Initialize dictionary to hold output
        output = {}
        
        # Retrieve metadata from endpoint
        logger.info(f"Retrieving metadata from {self.metadata_url}.")
        metadata = self.download_data_from_endpoint_raw("metadata")
        
        # Retrieve data from endpoint and convert to DataFrame (if get_raw_json = False)
        if not get_raw_json:
            logger.info(f"Retrieving data from {self.data_url}.")
            data_list = self.download_data_from_endpoint_DF()
            data = pd.DataFrame(data_list)
            if replace_column_names:
                data = self.replace_column_names(data, metadata)
        
        # Retrieve data from endpont leave as a json
        if get_raw_json: 
            logger.info(f"Retrieving data from {self.data_url}.")
            if replace_column_names: # Give warning if args conflict
                logger.warning("replace_column_names == True, but column names will not be replaced")
                logger.warning("because get_raw_json == True overrides. Returning data as a json.")
            data = self.download_data_from_endpoint_raw("data")
                    
        # Add DataFrame and metadata to output dict
        output['metadata'] = metadata  
        output['data'] = data
        
        logging.info("Success.")
        return output
    
    def download_data_from_endpoint_DF(self) -> list[dict]:
        """
        Download CDC data from a given endpoint with pagination.
            
        Returns:
            A list of dictionaries containing the json data for specified resource.  
        """
        all_data = []
        offset = 0
        batch_size = 1000
        
        # Reqeuest data from API in batches
        while True:
            logger.info(f"Downloading records {offset} through {offset + batch_size}")
            params = {
                "$limit": batch_size,
                "$offset": offset
            }
            
            try: 
                data_response = requests.get(self.data_url, params = params)
                data_response.raise_for_status()
                batch_data = data_response.json()
                
                if not batch_data: # No more data
                    break
                    
                all_data.extend(batch_data)
                offset += batch_size
                time.sleep(0.1) # Limit rate to prevent overload
            
            except Exception as e:
                logger.error(f"Error downloading data: {str(e)}")
                break
                
        return all_data
    
    def download_data_from_endpoint_raw(self, type_of_data: str) -> dict: 
        """
        Downlaod CDC data from a given endpoint as a dict (leave in json format).
        
        Returns:
            A dictionary of the data for specified resource.
        """
        
        # Retrieve metadata from endpoint 
        if type_of_data == "metadata":
            metadata_response = requests.get(self.metadata_url)
            metadata = metadata_response.json()
            return metadata
            
        # Retrieve data from endpoint
        elif type_of_data == "data":
            data_response = requests.get(self.data_url)
            data = data_response.json()
            return data
        
        # Incorrect type_of_data provided
        else:
            raise ValueError("type_of_data parameter must be either 'metadata' or 'data'.")
    
    def replace_column_names(self, data: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Replace short-form column names with long-form column names.
        
        Args:
            data: A pd.DataFrame of the data
            metadat: A dictionary of metadata containing column name information
            
        Returns:
            A pd.DataFrame with long-form column names.
        """

        df_columns = []
        for column_index in range(len(metadata['columns'])):
            df_columns.append(metadata['columns'][column_index]['name'])
        data.columns = df_columns
        
        return data