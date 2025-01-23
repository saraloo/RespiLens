import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

const InfoOverlay = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full hover:bg-red-100/50 text-red-400 inline-flex items-center"
      >
        <Info className="w-8 h-8" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />
          <div className="bg-white p-6 rounded-lg max-w-3xl mx-4 relative z-10 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <img src="respilens-logo.svg" alt="RespiLens Logo" className="h-12 w-12" />
              <h2 className="text-2xl font-bold">About RespiLens</h2>
            </div>

            <p className="mb-4">
              A visualization tool for respiratory disease forecasts hub in the US, focused on accessibility for state health departments and public users. Key features include:
            </p>

            <ul className="list-disc pl-6 mb-6 space-y-1">
              <li>URL-shareable views for specific forecasts</li>
              <li>Weekly automatic updates</li>
              <li>Multiple view types: categorical forecasts, scores, and time series</li>
              <li>Multi-date comparison capability</li>
              <li>Flexible model comparison</li>
            </ul>

            <p className="mb-6">
              Made by <a href="https://josephlemaitre.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Joseph Lemaitre</a> and UNC Chapel Hill and ACCIDDA, the Atlantic Coast Center for Infectious Disease Dynamics and Analytics
            </p>

            <h3 className="text-xl font-bold mb-2">About FluSight</h3>
            <p className="mb-4">
              <a href="https://www.cdc.gov/flu-forecasting/about/index.html" target="_blank" rel="noopener" className="text-blue-600 hover:underline">CDC's flu forecasting initiative</a> helps predict future influenza activity to support public health planning.
            </p>

            <p className="mb-2">
              <a href="https://github.com/cdcepi/FluSight-forecast-hub" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Flusight Forecast Hub github link</a>
            </p>

            <div className="mt-4">
              <p className="font-medium mb-2">Other Flusight viz by <a href="https://reichlab.io" target="_blank" rel="noopener" className="text-blue-600 hover:underline">reichlab</a>:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><a href="http://flusightnetwork.io" target="_blank" rel="noopener" className="text-blue-600 hover:underline">flusightnetwork.io</a> (historical)</li>
                <li><a href="https://zoltardata.com/project/360/viz" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Zoltar visualization</a> (last year season)</li>
                <li><a href="https://reichlab.io/flusight-dashboard/" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Current flusight dashboard</a></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoOverlay;
