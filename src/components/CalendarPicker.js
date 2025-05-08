import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Mobile-friendly Calendar component that won't close when navigating months
const CalendarPicker = ({ selectedDate, onChange, onClose }) => {
  // Get current date info for initialization
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(selectedDate ? new Date(selectedDate).getMonth() : today.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate ? new Date(selectedDate).getFullYear() : today.getFullYear());
  
  // Day names for header - shorter for mobile
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Month names for header
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Get days in month
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  
  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  
  // Format date as YYYY-MM-DD
  const formatDate = (year, month, day) => {
    // Pad with leading zeros
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };
  
  // Previous month
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  
  // Next month
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };
  
  // Check if a date is today
  const isToday = (year, month, day) => {
    const date = new Date(year, month, day);
    return date.toDateString() === today.toDateString();
  };
  
  // Check if a date is the selected date
  const isSelected = (year, month, day) => {
    if (!selectedDate) return false;
    
    const date = new Date(year, month, day);
    const selected = new Date(selectedDate);
    return date.toDateString() === selected.toDateString();
  };
  
  // Generate calendar grid
  const generateCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);
    
    // Create blank days for start of month
    const calendarDays = [...Array(firstDayOfMonth)].map(() => null);
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }
    
    // Group days into weeks (rows)
    const calendarRows = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      calendarRows.push(calendarDays.slice(i, i + 7));
    }
    
    // Pad last row if needed
    const lastRow = calendarRows[calendarRows.length - 1];
    if (lastRow.length < 7) {
      for (let i = lastRow.length; i < 7; i++) {
        lastRow.push(null);
      }
    }
    
    return calendarRows;
  };
  
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 w-full max-w-[340px] md:max-w-none">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="font-bold text-base md:text-lg">{monthNames[viewMonth]} {viewYear}</div>
        </div>
        <div className="flex gap-2">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 touch-manipulation" 
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 touch-manipulation" 
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Day Names Header */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((name, index) => (
          <div 
            key={index} 
            className="text-center text-xs md:text-sm font-medium text-gray-500 py-1"
          >
            {name}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="mb-3">
        {generateCalendarGrid().map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`
                  text-center py-2 text-sm cursor-pointer touch-manipulation
                  ${day ? 'hover:bg-blue-50 active:bg-blue-100' : ''}
                  ${isToday(viewYear, viewMonth, day) ? 'bg-blue-50 text-blue-600 font-bold' : ''}
                  ${isSelected(viewYear, viewMonth, day) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                `}
                onClick={() => day && onChange(formatDate(viewYear, viewMonth, day))}
              >
                {day}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Quick Date Selection Buttons - Better for touch */}
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        <button
          onClick={() => onChange(formatDate(today.getFullYear(), today.getMonth(), today.getDate()))}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm touch-manipulation"
        >
          Today
        </button>
        <button
          onClick={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            onChange(formatDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
          }}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm touch-manipulation"
        >
          Tomorrow
        </button>
        <button
          onClick={() => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            onChange(formatDate(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate()));
          }}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm touch-manipulation"
        >
          Next Week
        </button>
      </div>
      
      {/* Action Buttons - Larger for mobile */}
      <div className="flex justify-end gap-2 mt-2">
        <button 
          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg touch-manipulation"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default CalendarPicker;