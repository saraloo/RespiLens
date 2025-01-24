import React, { useState } from 'react';
import { Info, X, Github } from 'lucide-react';

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

            <h2 className="text-2xl font-bold mb-6">RespiLens</h2>

            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2">Alpha Version</h3>
              <p className="mb-2 flex items-center gap-2">
                This is an alpha version that may break unexpectedly. URL schemas and features may change. 
                Everyone is welcome to use it, and if you notice something that can be improved, 
                please raise an issue on GitHub 
                <a href="https://github.com/ACCIDDA/RespiLens" 
                   target="_blank" 
                   rel="noopener"
                   className="text-gray-700 hover:text-gray-900">
                  <Github className="w-5 h-5" />
                </a>
              </p>
            </div>

            <p className="mb-4">
              A responsive web app to visualize respiratory disease forecasts in the US, focused on 
              accessibility for state health departments and general public. Key features include:
            </p>

            <ul className="list-disc pl-6 mb-6 space-y-1">
              <li>URL-shareable views for specific forecasts</li>
              <li>Weekly automatic updates</li>
              <li>Multi-pathogen and multi-view</li>
              <li>Multi-date comparison capability</li>
              <li>Flexible model comparison</li>
              <li>Responsive and mobile friendly (for some views)</li>
            </ul>

            <div className="mb-6">
              <h3 className="font-bold mb-2">On the roadmap</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Scoring visualization and ability to select best models</li>
                <li>Multi-pathogen views</li>
                <li>Model description on hover</li>
              </ul>
            </div>

            <p className="mb-6">
              Made by Joseph Lemaitre (UNC Chapel Hill) and ACCIDDA, the Atlantic Coast Center 
              for Infectious Disease Dynamics and Analytics.
            </p>

            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2">About FluSight</h3>
              <p className="mb-2">
                CDC's flu forecasting initiative helps predict future influenza activity to support 
                public health planning.
                <a href="https://github.com/cdcepi/FluSight-forecast-hub" 
                   target="_blank" 
                   rel="noopener" 
                   className="text-blue-600 hover:underline ml-2">
                  Flusight Forecast Hub
                </a>
              </p>
              <p>
                <a href="https://rsvforecasthub.org" 
                   target="_blank" 
                   rel="noopener" 
                   className="text-blue-600 hover:underline">
                  About RSV forecast hub
                </a>
              </p>
            </div>

            <div className="mt-4">
              <p className="font-medium mb-2">Other Flusight viz by reichlab:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><a href="http://flusightnetwork.io" target="_blank" rel="noopener" 
                       className="text-blue-600 hover:underline">flusightnetwork.io</a> (historical)</li>
                <li><a href="https://zoltardata.com/project/360/viz" target="_blank" rel="noopener" 
                       className="text-blue-600 hover:underline">Zoltar visualization</a> (last year season)</li>
                <li><a href="https://reichlab.io/flusight-dashboard/" target="_blank" rel="noopener" 
                       className="text-blue-600 hover:underline">Current flusight dashboard</a></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoOverlay;
