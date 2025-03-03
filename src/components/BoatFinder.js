import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";
import { Search, Calendar, Loader } from 'lucide-react';

// Add this after your state variables (before fetchBoatAvailability)
const testApiEndpoint = async () => {
  try {
    const response = await fetch(`${window.location.origin}/api/test`);
    if (response.ok) {
      const data = await response.json();
      console.log('API test successful:', data);
      return true;
    } else {
      console.error('API test failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('API test error:', error);
    return false;
  }
};
// CORS proxies for calendar fetching
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/'
];

// Set this to false to make boats "busy" by default when calendar can't be fetched
// This is safer - better to show a boat as busy than to show it as available when it's not
const DEFAULT_TO_AVAILABLE = false;

// Cache for calendar data
const calendarCache = new Map();

// iCal parser with better date handling
const parseICalData = (icalData) => {
  // Function to safely parse dates from iCal format
  const safeParseDate = (dateStr) => {
    try {
      // Handle different iCal date formats
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
          parseInt(month, 10) - 1, // Months are 0-indexed
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
        return null;
      }
      
      return parsedDate;
    } catch (error) {
      return null;
    }
  };
  
  // If no data, return empty array
  if (!icalData || icalData.length === 0) {
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
          // Example: FREEBUSY:20250301T080000Z/20250301T100000Z,20250302T120000Z/20250302T140000Z
          const rangePart = line.substring(line.indexOf(':') + 1);
          const ranges = rangePart.split(',');
          
          ranges.forEach(range => {
            const [startStr, endStr] = range.split('/');
            const start = safeParseDate(startStr);
            const end = safeParseDate(endStr);
            
            if (start && end) {
              busyPeriods.push({ start, end });
            }
          });
        }
      }
      
      return busyPeriods;
    }
    
    // Otherwise, fall back to parsing VEVENT blocks
    const events = [];
    const lines = icalData.split('\n');
    let currentEvent = null;
    
    // Process each line, handling wrapped lines (continued with space or tab)
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Check if next line is a continuation (starts with space or tab)
      while (i + 1 < lines.length && 
             (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].trim();
      }
      
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { transparent: false }; // Default to opaque (busy) events
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.start && currentEvent.end) {
          // Only include non-transparent events (real busy periods)
          if (!currentEvent.transparent) {
            events.push(currentEvent);
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
    
    return events.filter(event => event.start && event.end);
  } catch (err) {
    return [];
  }
};

// Function to check cache and retrieve calendar data
const getFromCache = (key) => {
  if (calendarCache.has(key)) {
    const { data, timestamp } = calendarCache.get(key);
    // Cache data for 2 hours
    if (Date.now() - timestamp < 2 * 60 * 60 * 1000) {
      return data;
    }
  }
  
  // Check localStorage for longer term storage
  try {
    const stored = localStorage.getItem(`calendar_${key}`);
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      // Cache data for 24 hours in localStorage
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        // Also update memory cache
        calendarCache.set(key, { data, timestamp });
        return data;
      }
    }
  } catch (e) {
    // Silently fail on localStorage errors
  }
  
  return null;
};

// Function to save data to cache
const saveToCache = (key, data) => {
  const cacheObj = { 
    data, 
    timestamp: Date.now() 
  };
  
  // Save to memory cache
  calendarCache.set(key, cacheObj);
  
  // Also save to localStorage for persistence
  try {
    localStorage.setItem(`calendar_${key}`, JSON.stringify(cacheObj));
  } catch (e) {
    // Silently fail on localStorage errors
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

// Availability check function
const isAvailable = (selectedDate, bookedPeriods) => {
  // If no selected date, we can't determine availability
  if (!selectedDate) {
    return false;
  }
  
  // If no booked periods data, assume the boat is available
  if (!bookedPeriods || bookedPeriods.length === 0) {
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
    
    // Normalize the event end date to account for midnight boundary cases
    let normalizedEndDate;
    
    // If the event ends exactly at midnight (00:00:00), adjust it to be the previous day
    if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0 && endDate.getUTCSeconds() === 0) {
      // Create a new date that's 1 millisecond earlier (23:59:59.999 of the previous day)
      normalizedEndDate = new Date(endDate.getTime() - 1);
    } else {
      normalizedEndDate = new Date(endDate);
    }
    
    // Get the normalized end date in YYYY-MM-DD format
    const normalizedEndDateStr = normalizedEndDate.toISOString().split('T')[0];
    
    // Now check if our selected date is within the normalized range
    return startDateStr <= selectedDateStr && selectedDateStr <= normalizedEndDateStr;
  });
  
  return !isBusy;
};

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
  const [currentProxyIndex, setCurrentProxyIndex] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  const fetchBoatAvailability = async (boat) => {
    if (!boat.icalUrl) {
      return;
    }
    
    try {
      setCalendarLoading(prev => ({ ...prev, [boat.id]: true }));
      
      // Extract calendar ID/URL
      const calendarId = extractCalendarId(boat.icalUrl);
      if (!calendarId) {
        throw new Error(`Could not extract valid calendar ID from URL: ${boat.icalUrl}`);
      }
  
      // Skip cache when force refreshing
      const cacheKey = btoa(calendarId);
      const shouldUseCache = !forceRefresh;
      const cachedData = shouldUseCache ? getFromCache(cacheKey) : null;
      
      if (cachedData) {
        console.log(`Using cached data for ${boat.name}`);
        const events = parseICalData(cachedData);
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: events
        }));
        return;
      }
  
      // Log which boat we're fetching
      console.log(`Fetching calendar for ${boat.name} (${boat.id})`);
      
      const origin = window.location.origin;
      let success = false;
      let icalData = null;
      
      // Try approach 1: Use the new minimal calendar-proxy endpoint
      if (!success) {
        try {
          const proxyUrl = `${origin}/api/calendar-proxy?calendarId=${encodeURIComponent(calendarId)}&nocache=${Date.now()}`;
          console.log('Trying calendar-proxy endpoint:', proxyUrl);
          
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }
          
          if (data.data && data.data.includes('BEGIN:VCALENDAR')) {
            console.log('Successfully fetched calendar data via calendar-proxy');
            icalData = data.data;
            success = true;
          }
        } catch (error) {
          console.error('calendar-proxy attempt failed:', error.message);
        }
      }
      
      // Try approach 2: Use the original API endpoint (as a fallback)
      if (!success) {
        try {
          const apiUrl = `${origin}/api/calendar?calendarId=${encodeURIComponent(calendarId)}&nocache=${Date.now()}`;
          console.log('Trying original calendar endpoint:', apiUrl);
          
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }
          
          if (data.data && data.data.includes('BEGIN:VCALENDAR')) {
            console.log('Successfully fetched calendar data via original API');
            icalData = data.data;
            success = true;
          }
        } catch (error) {
          console.error('Original API attempt failed:', error.message);
        }
      }
      
      // Try approach 3: Direct external CORS proxy (only if internal proxies fail)
      if (!success) {
        // Loop through external CORS proxies until one works
        for (const proxy of CORS_PROXIES) {
          if (success) break;
          
          try {
            console.log(`Trying external proxy ${proxy} for boat ${boat.name}`);
            
            // Format Google Calendar URL properly
            const googleCalendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
            const proxyUrl = `${proxy}${encodeURIComponent(googleCalendarUrl)}?nocache=${Date.now()}`;
            
            const response = await fetch(proxyUrl, {
              method: 'GET',
              mode: 'cors',
              cache: 'no-store',
              headers: {
                'Accept': 'text/calendar, text/plain, */*'
              }
            });
            
            if (!response.ok) {
              continue;
            }
            
            const data = await response.text();
            
            // Basic validation
            if (data.includes('BEGIN:VCALENDAR')) {
              console.log(`Successfully fetched via ${proxy}`);
              icalData = data;
              success = true;
              break;
            }
          } catch (proxyError) {
            console.error(`Proxy ${proxy} failed:`, proxyError.message);
          }
        }
      }
      
      // If we have data, process it
      if (success && icalData) {
        // Parse the calendar data
        const events = parseICalData(icalData);
        
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: events
        }));
        
        // Save to cache if not force refreshing
        if (!forceRefresh) {
          saveToCache(cacheKey, icalData);
        }
        
        return;
      }
      
      throw new Error('All calendar fetch methods failed');
      
    } catch (error) {
      console.error(`Calendar fetch failed for ${boat.name}: ${error.message}`);
      
      // Default to our chosen availability strategy
      if (DEFAULT_TO_AVAILABLE) {
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: []
        }));
      } else {
        // Create a blocking event for safety
        const today = new Date();
        const endOfYear = new Date(today.getFullYear() + 1, 11, 31);
        
        const blockingEvent = [{
          start: today,
          end: endOfYear,
          transparent: false,
          note: "Calendar unavailable - assuming busy for safety"
        }];
        
        setAvailabilityData(prev => ({
          ...prev,
          [boat.id]: blockingEvent
        }));
      }
      
      setError(`Failed to fetch calendar for ${boat.name}: ${error.message}`);
    } finally {
      setCalendarLoading(prev => ({ ...prev, [boat.id]: false }));
    }
  };

  // Force Reload function
  const handleForceReload = async () => {
    setError(null);
    
    // Set force refresh mode
    setForceRefresh(true);
    
    // Clear all caches
    calendarCache.clear();
    
    // Clear localStorage items related to calendars
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('calendar_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Move to next proxy for retries
    setCurrentProxyIndex((currentProxyIndex + 1) % CORS_PROXIES.length);
    
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
    
    // Fetch all calendars again with larger delays
    try {
      for (const boat of calendarBoats) {
        await fetchBoatAvailability(boat);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } finally {
      // Clear loading state and reset force refresh mode
      calendarBoats.forEach(boat => {
        setCalendarLoading(prev => ({ ...prev, [boat.id]: false }));
      });
      setForceRefresh(false);
    }
  };
  
  // Handle retry of all calendar data
  const handleRetryCalendars = async () => {
    setError(null);
    
    // Move to next proxy for retries
    setCurrentProxyIndex((currentProxyIndex + 1) % CORS_PROXIES.length);
    
    // Get boats with calendars
    const calendarBoats = boats.filter(
      boat => boat.availabilityType === 'ical' && boat.icalUrl
    );
    
    // Clear existing availability data
    setAvailabilityData({});
    
    // Fetch all calendars again
    for (const boat of calendarBoats) {
      await fetchBoatAvailability(boat);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // Clear cache for fresh data
  const handleClearCache = () => {
    // Clear memory cache
    calendarCache.clear();
    
    // Clear localStorage items related to calendars
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('calendar_')) {
        localStorage.removeItem(key);
      }
    });
    
    alert('Calendar cache cleared. Click Refresh Calendars to fetch new data.');
  };
  
  useEffect(() => {
    const fetchBoats = async () => {
      try {
        setLoading(true);
        
        // Test API connectivity first
        const apiWorking = await testApiEndpoint();
        if (!apiWorking) {
          console.warn('API test failed, will attempt to use external proxies as fallback');
        }
        
        const boatsRef = collection(db, 'boats');
        const snapshot = await getDocs(boatsRef);
        const boatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setBoats(boatsData);
  
        // Fetch calendars for boats with iCal URLs
        const calendarBoats = boatsData.filter(
          boat => boat.availabilityType === 'ical' && boat.icalUrl
        );
        
        // Fetch calendars one by one to avoid overwhelming the system
        for (const boat of calendarBoats) {
          await fetchBoatAvailability(boat);
          // Increasing delay between requests to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 800));
        }
  
      } catch (err) {
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

