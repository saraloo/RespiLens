import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

const InfoOverlay = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full hover:bg-gray-100"
      >
        <Info className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl mx-4 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">About RespiView</h2>
            <p className="text-gray-600">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do 
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim 
              ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut 
              aliquip ex ea commodo consequat.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoOverlay;
