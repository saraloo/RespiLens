import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const DateSelector = ({ availableDates, selectedDates, setSelectedDates, activeDate, setActiveDate }) => {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-center">
      {selectedDates.map((date, index) => (
        <div key={date} className="flex items-center gap-2">
          <button 
            onClick={() => {
              const sortedDates = selectedDates.slice().sort();
              const dateIndex = availableDates.indexOf(date);
              const currentPosition = sortedDates.indexOf(date);
              const prevDate = availableDates[dateIndex - 1];
              
              if (prevDate && (!sortedDates[currentPosition - 1] || new Date(prevDate) > new Date(sortedDates[currentPosition - 1]))) {
                const newDates = [...selectedDates];
                newDates[selectedDates.indexOf(date)] = prevDate;
                setSelectedDates(newDates.sort());
                setActiveDate(prevDate);
              }
            }}
            disabled={
              availableDates.indexOf(date) === 0 ||
              (selectedDates.includes(availableDates[availableDates.indexOf(date) - 1]))
            }
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className={`font-medium ${date === activeDate ? 'text-blue-600' : ''}`}>
              Week of {date}
            </span>
            <button
              onClick={() => setSelectedDates(dates => dates.filter(d => d !== date))}
              className="p-1 rounded-full hover:bg-gray-100"
              disabled={selectedDates.length === 1}
              style={{ opacity: selectedDates.length === 1 ? 0.5 : 1 }}
            >
              ×
            </button>
          </div>

          <button 
            onClick={() => {
              const sortedDates = selectedDates.slice().sort();
              const dateIndex = availableDates.indexOf(date);
              const currentPosition = sortedDates.indexOf(date);
              const nextDate = availableDates[dateIndex + 1];
              
              if (nextDate && (!sortedDates[currentPosition + 1] || new Date(nextDate) < new Date(sortedDates[currentPosition + 1]))) {
                const newDates = [...selectedDates];
                newDates[selectedDates.indexOf(date)] = nextDate;
                setSelectedDates(newDates.sort());
                setActiveDate(nextDate);
              }
            }}
            disabled={
              availableDates.indexOf(date) === availableDates.length - 1 ||
              (selectedDates.includes(availableDates[availableDates.indexOf(date) + 1]))
            }
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ))}
      
      {selectedDates.length < 5 && (
        <button
          onClick={() => {
            if (selectedDates.length >= 5) return;
            
            const sortedSelectedDates = selectedDates.slice().sort();
            const latestSelectedDate = sortedSelectedDates[sortedSelectedDates.length - 1];
            const earliestSelectedDate = sortedSelectedDates[0];
            const latestSelectedIdx = availableDates.indexOf(latestSelectedDate);
            const earliestSelectedIdx = availableDates.indexOf(earliestSelectedDate);
            
            let dateToAdd;
            
            if (latestSelectedIdx === availableDates.length - 1) {
              if (earliestSelectedIdx > 0) {
                dateToAdd = availableDates[earliestSelectedIdx - 1];
              }
            } else {
              dateToAdd = availableDates[latestSelectedIdx + 1];
            }

            if (dateToAdd && !selectedDates.includes(dateToAdd)) {
              setSelectedDates([...selectedDates, dateToAdd].sort());
              setActiveDate(dateToAdd);
            }
          }}
          disabled={selectedDates.length >= 5}
          className={`px-3 py-1 rounded border ${
            selectedDates.length >= 5 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-gray-100'
          }`}
        >
          + Add Date
        </button>
      )}
    </div>
  );
};

export default DateSelector;
