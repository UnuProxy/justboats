import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";
import { Search, Calendar, Loader } from 'lucide-react';

// Enable this for debugging - set to false in production
const DEBUG = true;

// Set this to true to make boats "available" by default when calendar can't be fetched
const DEFAULT_TO_AVAILABLE = true;

// iCal parser function
const parseICalData = (icalData) => {
  if (DEBUG) console.log("Parsing iCal data, length:", icalData?.length || 0);
  
  // Function to safely parse dates from iCal format
  const safeParseDate = (dateStr) => {
    try {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      
      let parsedDate;
      
      // Format: 20230427T090000Z (basic format)
      if (dateStr.includes('T') && dateStr.includes('Z')) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(9, 11);
        const minute = dateStr.substring(11, 13);
        const second = dateStr.substring(13, 15);
        
        parsedDate = new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        ));
      } 
      // Format: 20230427 (date only)
      else if (dateStr.length === 8 && !dateStr.includes('T')) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        parsedDate = new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10)
        ));
      }
      // Try standard date parsing
      else {
        parsedDate = new Date(dateStr);
      }
      
      // Validate if parsedDate is valid
      if (isNaN(parsedDate.getTime())) {
        if (DEBUG) console.warn(`Failed to parse date: ${dateStr}`);
        return null;
      }
      
      return parsedDate;
    } catch (error) {
      if (DEBUG) console.warn(`Error parsing date '${dateStr}':`, error.message);
      return null;
    }
  };
  
  if (!icalData || icalData.length === 0) {
    if (DEBUG) console.log("No iCal data provided");
    return [];
  }
  
  try {
    // If the feed contains VFREEBUSY blocks, use that
    if (icalData.includes('BEGIN:VFREEBUSY')) {
      const busyPeriods = [];
      const lines = icalData.split('\n');
      let insideVFreeBusy = false;
      
      for (let rawLine of lines) {
        const line = rawLine.trim();
        if (line === 'BEGIN:VFREEBUSY') {
          insideVFreeBusy = true;
        } else if (line === 'END:VFREEBUSY') {
          insideVFreeBusy = false;
        } else if (insideVFreeBusy && line.startsWith('FREEBUSY:')) {
          const rangePart = line.substring(line.indexOf(':') + 1);
          const ranges = rangePart.split(',');
          
          ranges.forEach(range => {
            const [startStr, endStr] = range.split('/');
            const start = safeParseDate(startStr);
            const end = safeParseDate(endStr);
            
            if (start && end) {
              busyPeriods.push({ start, end });
              if (DEBUG) console.log(`Found busy period: ${start.toISOString()} to ${end.toISOString()}`);
            }
          });
        }
      }
      
      if (DEBUG) console.log(`Parsed ${busyPeriods.length} busy periods from VFREEBUSY`);
      return busyPeriods;
    }
    
    // Otherwise, fall back to parsing VEVENT blocks
    const events = [];
    const lines = icalData.split('\n');
    let currentEvent = null;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Check if next line is a continuation
      while (i + 1 < lines.length && 
             (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].trim();
      }
      
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { transparent: false };
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.start && currentEvent.end) {
          if (!currentEvent.transparent) {
            events.push(currentEvent);
            if (DEBUG) console.log(`Found busy event: ${currentEvent.start.toISOString()} to ${currentEvent.end.toISOString()}`);
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        // Process date fields
        if (line.startsWith('DTSTART')) {
          const datePart = line.substring(line.indexOf(':') + 1);
          currentEvent.start = safeParseDate(datePart);
        } else if (line.startsWith('DTEND')) {
          const datePart = line.substring(line.indexOf(':') + 1);
          currentEvent.end = safeParseDate(datePart);
        } else if (line.startsWith('TRANSP')) {
          // Check if the event is marked as transparent (free)
          currentEvent.transparent = line.includes('TRANSPARENT');
        }
      }
    }
    
    const validEvents = events.filter(event => event.start && event.end);
    if (DEBUG) console.log(`Parsed ${validEvents.length} valid busy events from VEVENT blocks`);
    return validEvents;
  } catch (err) {
    if (DEBUG) console.error("Error parsing iCal data:", err);
    return [];
  }
};

// Simple cache implementation
const cache = {
  data: new Map(),
  set: function(key, value, ttl = 3600000) { // Default TTL: 1 hour
    this.data.set(key, {
      value,
      expires: Date.now() + ttl
    });
    return value;
  },
  get: function(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  },
  clear: function() {
    this.data.clear();
  }
};

// Extract calendar ID from URL
const extractCalendarId = (url) => {
  if (!url) return null;
  
  // Google Calendar format: calendar/ical/email@example.com/public/basic.ics
  if (url.includes('calendar/ical/')) {
    const match = url.match(/calendar\/ical\/([^/]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  
  // Alternative Google format: /calendars/email@example.com/events
  if (url.includes('/calendars/')) {
    const match = url.match(/\/calendars\/([^/]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  
  // Direct email input
  if (url.includes('@') && !url.includes('/')) {
    return url;
  }
  
  // For any other URL format, return the entire URL
  return url;
};

// Availability check function with improved date handling
const isAvailable = (selectedDate, bookedPeriods) => {
  if (DEBUG) console.log(`Checking availability for date: ${selectedDate}`);
  
  if (!selectedDate) {
    return false;
  }
  
  if (!bookedPeriods || bookedPeriods.length === 0) {
    if (DEBUG) console.log("No booked periods found, marking as available");
    return true;
  }
  
  // Create a date object for the selected date normalized to midnight UTC
  const selectedDateObj = new Date(selectedDate + 'T00:00:00Z');
  const selectedDateStr = selectedDateObj.toISOString().split('T')[0];
  
  // Check if the date falls within any booked period
  const isBusy = bookedPeriods.some(period => {
    if (!period || !period.start || !period.end) return false;
    
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    
    // Normalize dates to YYYY-MM-DD for comparison
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Handle midnight boundary case (if the event ends at exactly midnight)
    let normalizedEndDate;
    if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0 && endDate.getUTCSeconds() === 0) {
      // Create a new date that's 1 millisecond earlier (23:59:59.999 of the previous day)
      normalizedEndDate = new Date(endDate.getTime() - 1);
    } else {
      normalizedEndDate = new Date(endDate);
    }
    
    // Get the normalized end date in YYYY-MM-DD format
    const normalizedEndDateStr = normalizedEndDate.toISOString().split('T')[0];
    
    // Check if our selected date is within the normalized range
    const isBooked = startDateStr <= selectedDateStr && selectedDateStr <= normalizedEndDateStr;
    
    if (isBooked && DEBUG) {
      console.log(`BOOKED: Date ${selectedDateStr} is within period ${startDateStr} to ${normalizedEndDateStr}`);
    }
    
    return isBooked;
  });
  
  return !isBusy;
};

// Get availability status for display
const getAvailabilityStatus = (boat, selectedDate, availabilityData) => {
  if (!selectedDate) return null;
  
  const free = isAvailable(selectedDate, availabilityData[boat.id]);
  return {
    available: free,
    message: free ? 'Available ✓' : 'Busy ✗',
    class: free ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
    details: free ? 'Boat is available on this date' : 'Boat is already booked for this date'
  };
};

// Boat card component
const BoatCard = ({ boat, selectedDate, availabilityData }) => (
  <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
    <div className="relative w-full h-64">
      <img
        src={boat.images?.[0] || '/api/placeholder/400/320'}
        alt={boat.name}
        className="w-full h-full object-cover rounded-t-lg"
      />
      {boat.availabilityType === 'ical' && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
          <Calendar size={16} />
          Live Calendar
        </div>
      )}
    </div>
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">{boat.name}</h2>
      {boat.availabilityType === 'ical' && selectedDate && (
        <div className="mt-2">
          <span 
            className={`p-2 rounded ${getAvailabilityStatus(boat, selectedDate, availabilityData)?.class}`}
            title={getAvailabilityStatus(boat, selectedDate, availabilityData)?.details}
          >
            {getAvailabilityStatus(boat, selectedDate, availabilityData)?.message}
          </span>
        </div>
      )}
      <div className="space-y-2 text-gray-600 mt-4">
        <p className="text-base">
          <span className="font-medium">Length:</span> {boat.detailedSpecs?.Length || 'N/A'}
        </p>
        <p className="text-base">
          <span className="font-medium">Price:</span> {boat.price || boat.seasonalPrices?.Standard || 'N/A'}€/day
        </p>
      </div>
    </div>
  </div>
);

// Main component
const BoatFinder = () => {
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState({});
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availabilityData, setAvailabilityData] = useState({});
  const [filters, setFilters] = useState({
    length: '',
    minPrice: '',
    maxPrice: '',
  });
  const [activeSearch, setActiveSearch] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Simplified function to fetch boat availability using only the API route
  const fetchBoatAvailability = async (boat) => {
    if (!boat.icalUrl) {
      return;
    }
    
    try {
      setCalendarLoading(prev => ({ ...prev, [boat.id]: true }));
      
      // Extract calendar ID
      const calendarId = extractCalendarId(boat.icalUrl);
      if (!calendarId) {
        throw new Error(`Could not extract valid calendar ID`);
      }
  
      // Determine calendar URL based on the format
      let calendarUrl;
      if (calendarId.startsWith('http') || calendarId.startsWith('https') || calendarId.startsWith('webcal')) {
        calendarUrl = calendarId.replace('webcal://', 'https://');
      } else if (calendarId.includes('@')) {
        calendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
      } else {
        calendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
      }
  
      if (DEBUG) console.log(`Processing calendar for ${boat.name}: ${calendarUrl}`);

      // Add anti-cache parameter - only for the API request
      const antiCacheParam = `?nocache=${Date.now()}`;

      // Skip cache when force refreshing
      const cacheKey = btoa(calendarUrl);
      const shouldUseCache = !forceRefresh;
      const cachedData = shouldUseCache ? cache.get(cacheKey) : null;
      
      if (cachedData) {
        if (DEBUG) console.log(`Using cached calendar data for ${boat.name}`);
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: cachedData
        }));
        return;
      }

      // Try the API route - this is the primary method
      try {
        if (DEBUG) console.log(`Fetching calendar via API for ${boat.name}`);
        
        // Use a direct URL with the antiCacheParam
        const backendUrl = `/api/calendar?url=${encodeURIComponent(calendarUrl + antiCacheParam)}`;
        const apiResponse = await fetch(backendUrl);
        
        if (apiResponse.ok) {
          const data = await apiResponse.json();
          
          if (DEBUG) console.log(`API success for ${boat.name}: ${data.events?.length || 0} events`);
          
          if (data.events) {
            const events = data.events;
            setAvailabilityData(prev => ({
              ...prev,
              [boat.id]: events
            }));
            
            // Save to cache
            cache.set(cacheKey, events);
            return;
          } else if (data.data) {
            // Parse the raw data
            const events = parseICalData(data.data);
            setAvailabilityData(prev => ({
              ...prev,
              [boat.id]: events
            }));
            
            // Save to cache
            cache.set(cacheKey, events);
            return;
          }
        } else {
          if (DEBUG) console.warn(`API failed for ${boat.name}: ${apiResponse.status}`);
          // Continue to fallback
        }
      } catch (apiError) {
        if (DEBUG) console.error(`API error for ${boat.name}:`, apiError);
        // Continue to fallback
      }
      
      // Last resort - use default availability
      if (DEBUG) console.log(`Using default availability for ${boat.name}: ${DEFAULT_TO_AVAILABLE ? 'AVAILABLE' : 'BUSY'}`);
      
      if (DEFAULT_TO_AVAILABLE) {
        // Default to available (empty array means no busy periods)
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: []
        }));
      } else {
        // Default to busy
        const today = new Date();
        const endOfYear = new Date(today.getFullYear() + 1, 11, 31);
        
        const blockingEvent = [{
          start: today,
          end: endOfYear,
          transparent: false,
          note: "Calendar unavailable"
        }];
        
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: blockingEvent
        }));
      }
    } catch (error) {
      if (DEBUG) console.error(`Error for ${boat.name}:`, error);
      
      // Use default availability strategy on error
      if (DEFAULT_TO_AVAILABLE) {
        // Default to available
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: []
        }));
      } else {
        // Default to busy
        const today = new Date();
        const endOfYear = new Date(today.getFullYear() + 1, 11, 31);
        
        const blockingEvent = [{
          start: today,
          end: endOfYear,
          transparent: false,
          note: "Calendar unavailable"
        }];
        
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: blockingEvent
        }));
      }
    } finally {
      setCalendarLoading(prev => ({ ...prev, [boat.id]: false }));
    }
  };

  // Force Reload function
  const handleForceReload = async () => {
    if (DEBUG) console.log("Force reloading all calendars");
    setError(null);
    setForceRefresh(true);
    
    // Clear cache
    cache.clear();
    
    // Get boats with calendars
    const calendarBoats = boats.filter(
      boat => boat.availabilityType === 'ical' && boat.icalUrl
    );
    
    // Clear existing availability data
    setAvailabilityData({});
    
    // Show loading state
    calendarBoats.forEach(boat => {
      setCalendarLoading(prev => ({ ...prev, [boat.id]: true }));
    });
    
    // Fetch all calendars again with delays
    try {
      for (const boat of calendarBoats) {
        await fetchBoatAvailability(boat);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      // Clear loading state
      calendarBoats.forEach(boat => {
        setCalendarLoading(prev => ({ ...prev, [boat.id]: false }));
      });
      setForceRefresh(false);
    }
  };
  
  // Handle retry of all calendar data
  const handleRetryCalendars = async () => {
    if (DEBUG) console.log("Retrying calendars");
    setError(null);
    
    // Get boats with calendars
    const calendarBoats = boats.filter(
      boat => boat.availabilityType === 'ical' && boat.icalUrl
    );
    
    // Fetch all calendars again
    for (const boat of calendarBoats) {
      await fetchBoatAvailability(boat);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  };

  // Clear cache
  const handleClearCache = () => {
    cache.clear();
    alert('Calendar cache cleared. Click Refresh Calendars to fetch new data.');
  };
  
  useEffect(() => {
    const fetchBoats = async () => {
      try {
        setLoading(true);
        const boatsRef = collection(db, 'boats');
        const snapshot = await getDocs(boatsRef);
        const boatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setBoats(boatsData);

        if (DEBUG) console.log(`Loaded ${boatsData.length} boats from database`);

        // Fetch calendars for boats with iCal URLs
        const calendarBoats = boatsData.filter(
          boat => boat.availabilityType === 'ical' && boat.icalUrl
        );
        
        if (DEBUG) console.log(`Found ${calendarBoats.length} boats with iCal URLs`);
        
        // Fetch calendars one by one
        for (const boat of calendarBoats) {
          await fetchBoatAvailability(boat);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (err) {
        if (DEBUG) console.error(`Error fetching boats:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBoats();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    setActiveSearch(true);
  };

  const filteredBoats = activeSearch ? boats.filter(boat => {
    // Check boat type
    if (boat.availabilityType !== 'ical' || !boat.icalUrl) {
      return false;
    }
    
    // Check if the boat is available on the selected date
    const available = isAvailable(selectedDate, availabilityData[boat.id]);
    
    // If the boat is busy, we should NOT show it in results
    if (!available) {
      return false;
    }
    
    // Apply additional filters
    const matchesLength = !filters.length || 
      (boat.detailedSpecs?.Length?.toString().includes(filters.length));
      
    const price = boat.price || boat.seasonalPrices?.Standard || 0;
    const matchesPrice =
      (!filters.minPrice || price >= Number(filters.minPrice)) &&
      (!filters.maxPrice || price <= Number(filters.maxPrice));
    
    return matchesLength && matchesPrice;
  }) : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <h1 className="text-2xl font-bold">Available Boats</h1>
        <div className="flex gap-2">
          <button 
            onClick={handleClearCache} 
            className="bg-gray-100 text-gray-800 px-3 py-1 rounded-md flex items-center gap-1 text-sm"
          >
            Clear Cache
          </button>
          <button 
            onClick={handleRetryCalendars} 
            className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md flex items-center gap-1"
          >
            <Calendar size={16} />
            Refresh Calendars
          </button>
          <button 
            onClick={handleForceReload} 
            className="bg-red-100 text-red-800 px-3 py-1 rounded-md flex items-center gap-1"
          >
            Force Reload
          </button>
        </div>
      </div>
      
      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-2 border rounded-lg"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Length (meters)
            </label>
            <input
              type="number"
              name="length"
              placeholder="e.g. 12"
              value={filters.length}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Range (€)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="minPrice"
                placeholder="Min"
                value={filters.minPrice}
                onChange={handleFilterChange}
                className="w-1/2 p-2 border rounded-lg"
              />
              <input
                type="number"
                name="maxPrice"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                className="w-1/2 p-2 border rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Search size={20} />
              Find Available Boats
            </button>
          </div>
        </div>
      </div>

      {/* Debug Information - Only visible in DEBUG mode */}
      {DEBUG && selectedDate && (
        <div className="bg-gray-100 p-4 mb-6 rounded-lg">
          <h3 className="font-bold mb-2">Availability Debug Info:</h3>
          <p>Selected Date: {selectedDate}</p>
          <p>Total Boats: {boats.length}</p>
          <p>Boats with Calendars: {Object.keys(availabilityData).length}</p>
          <p>Filtered Boats: {filteredBoats.length}</p>
          <p>Default to Available: {DEFAULT_TO_AVAILABLE ? 'YES' : 'NO'}</p>
          
          {/* Calendar data status */}
          <div className="mt-2">
            <h4 className="font-semibold">Calendar Data Status:</h4>
            <ul className="mt-1 space-y-1">
              {boats
                .filter(boat => boat.availabilityType === 'ical')
                .map(boat => (
                  <li key={boat.id} className="text-sm">
                    {boat.name}: {' '}
                    {calendarLoading[boat.id] ? (
                      <span className="text-yellow-600">Loading...</span>
                    ) : availabilityData[boat.id] ? (
                      <span className="text-green-600">
                        {availabilityData[boat.id].length} events loaded
                      </span>
                    ) : (
                      <span className="text-red-600">No data</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
          
          {/* Calendar Events for Selected Date */}
          <div className="mt-4">
            <h4 className="font-semibold">Calendar Events for Selected Date:</h4>
            <div className="mt-2 p-3 bg-white rounded shadow">
              <ul className="space-y-2">
                {boats
                  .filter(boat => boat.availabilityType === 'ical')
                  .map(boat => {
                    const events = availabilityData[boat.id] || [];
                    
                    // Check which events affect the selected date
                    const selectedDateStr = new Date(selectedDate + 'T00:00:00Z').toISOString().split('T')[0];
                    
                    const dateEvents = events.filter(event => {
                      if (!event || !event.start || !event.end) return false;
                      
                      const startDate = new Date(event.start);
                      const endDate = new Date(event.end);
                      
                      const startDateStr = startDate.toISOString().split('T')[0];
                      
                      // Normalize end date for midnight boundaries
                      let normalizedEndDate;
                      if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0 && endDate.getUTCSeconds() === 0) {
                        normalizedEndDate = new Date(endDate.getTime() - 1);
                      } else {
                        normalizedEndDate = new Date(endDate);
                      }
                      
                      const normalizedEndDateStr = normalizedEndDate.toISOString().split('T')[0];
                      
                      return startDateStr <= selectedDateStr && selectedDateStr <= normalizedEndDateStr;
                    });
                    
                    return (
                      <li key={boat.id} className="text-sm">
                        <span className="font-semibold">{boat.name}:</span>{' '}
                        {dateEvents.length === 0 ? (
                          <span className="text-green-600">Available</span>
                        ) : (
                          <span className="text-red-600">
                            Busy - {dateEvents.length} event(s) found
                          </span>
                        )}
                        {dateEvents.length > 0 && (
                          <ul className="ml-4 mt-1 space-y-1 text-xs">
                            {dateEvents.map((event, idx) => (
                              <li key={idx} className="text-gray-700">
                                {new Date(event.start).toLocaleString()} to {new Date(event.end).toLocaleString()}
                                {event.note && (
                                  <span className="ml-2 text-orange-500">[{event.note}]</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSearch ? (
          filteredBoats.length > 0 ? (
            filteredBoats.map(boat => (
              <div key={boat.id} className="relative">
                {calendarLoading[boat.id] && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                    <Loader className="animate-spin h-6 w-6 text-blue-500" />
                  </div>
                )}
                <BoatCard
                  boat={boat}
                  selectedDate={selectedDate}
                  availabilityData={availabilityData}
                />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500">
              No available boats found matching your criteria. Please try a different date or search parameters.
            </div>
          )
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            Use the filters above to find available boats.
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-800 p-4 rounded-lg shadow-lg max-w-md">
          <div className="flex justify-between">
            <div>{error}</div>
            <button 
              className="ml-2 font-bold"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
          <div className="mt-2 text-sm">
            <p>Try using the Clear Cache button and then Refresh Calendars if calendar data isn&apos;t loading properly.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoatFinder;

