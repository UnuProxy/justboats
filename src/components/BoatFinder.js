import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";
import { Search, Filter, Calendar } from 'lucide-react';

/* ====================================================
   HELPER FUNCTIONS
==================================================== */

// Format dates for logging or display
const formatDisplayDate = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

// Parse iCal data into an array of event objects with start, end, summary.
const parseICalData = (icalData) => {
  const events = [];
  const lines = icalData.split('\n');
  let currentEvent = null;

  lines.forEach(lineRaw => {
    const line = lineRaw.trim();
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent?.start && currentEvent?.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      try {
        if (line.startsWith('DTSTART')) {
          const dateStr = line.split(':')[1];
          currentEvent.start = new Date(dateStr);
          // Uncomment for debugging:
          // console.log('Parsed start date:', dateStr, currentEvent.start);
        } else if (line.startsWith('DTEND')) {
          const dateStr = line.split(':')[1];
          currentEvent.end = new Date(dateStr);
          // console.log('Parsed end date:', dateStr, currentEvent.end);
        } else if (line.startsWith('SUMMARY')) {
          currentEvent.summary = line.split(':')[1];
        }
      } catch (error) {
        console.error('Error parsing line:', line, error);
      }
    }
  });
  // Only return events with valid dates
  return events.filter(event =>
    event.start instanceof Date &&
    !isNaN(event.start) &&
    event.end instanceof Date &&
    !isNaN(event.end)
  );
};

// Check whether the boat is available between startDate and endDate
// given an array of booked periods.
const isAvailable = (startDate, endDate, bookedPeriods) => {
  // If no date range is selected or there are no bookings, assume available.
  if (!startDate || !endDate || !bookedPeriods?.length) {
    return true;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check for any overlapping booking.
  const hasOverlap = bookedPeriods.some(period => {
    const bookedStart = new Date(period.start);
    const bookedEnd = new Date(period.end);
    const overlaps = start < bookedEnd && end > bookedStart;
    if (overlaps) {
      console.log(`Overlap found: ${formatDisplayDate(bookedStart)} - ${formatDisplayDate(bookedEnd)}`);
    }
    return overlaps;
  });

  return !hasOverlap;
};

// For display purposes: return a status badge object.
const getAvailabilityStatus = (boat, startDate, endDate, availabilityData) => {
  // If no date range is selected, do not show status.
  if (!startDate || !endDate) return null;
  const free = isAvailable(startDate, endDate, availabilityData[boat.id]);
  return {
    available: free,
    message: free ? 'Available' : 'Busy',
    class: free ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  };
};

  
/* ====================================================
   MAIN COMPONENT: BoatFinder
==================================================== */
const BoatFinder = () => {
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availabilityData, setAvailabilityData] = useState({}); // keyed by boat.id
  const [filters, setFilters] = useState({
    type: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    company: ''
  });

  /* ====================================================
     FETCH iCal DATA FOR A GIVEN BOAT
  ===================================================== */
  const fetchBoatAvailability = async (icalUrl) => {
    try {
      let proxyUrl;
      // If the URL is from Google Calendar, extract the calendar ID.
      if (icalUrl.includes('calendar.google.com')) {
        const calendarId = icalUrl.split('/calendar/ical/')[1].split('/public')[0];
        proxyUrl = `/api/google-calendar-proxy?calendarId=${encodeURIComponent(calendarId)}`;
      } else {
        proxyUrl = `/api/ical-proxy?url=${encodeURIComponent(icalUrl)}`;
      }
      console.log('Fetching calendar through proxy:', proxyUrl);
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error: ${response.status}`);
      }
      const data = await response.text();
      console.log('Raw iCal data, length:', data.length);
      // If data starts with HTML, then something’s wrong.
      if (data.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('Received HTML instead of iCal data. Check that the calendar is public.');
      }
      if (!data.includes('BEGIN:VCALENDAR')) {
        throw new Error('Invalid iCal data received');
      }
      const events = parseICalData(data);
      // Filter events so that only future events are considered.
      const now = new Date();
      const futureEvents = events.filter(event => new Date(event.end) >= now);
      return futureEvents;
    } catch (error) {
      console.error('Error fetching iCal data:', error, 'URL:', icalUrl);
      return []; // On error, assume no bookings
    }
  };

  /* ====================================================
     FETCH BOATS FROM FIREBASE
  ===================================================== */
  useEffect(() => {
    const fetchBoats = async () => {
      try {
        setLoading(true);
        // Replace 'boats' with your Firebase collection name.
        const boatsRef = collection(db, 'boats');
        const snapshot = await getDocs(boatsRef);
        const boatsFromFirebase = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, source: 'firebase', ...data };
        });
        console.log('Fetched boats:', boatsFromFirebase);

        // For boats that use iCal availability, fetch their events.
        const availabilityObj = {};
        const icalBoats = boatsFromFirebase.filter(boat => boat.availabilityType === 'ical' && boat.icalUrl);
        for (const boat of icalBoats) {
          try {
            const events = await fetchBoatAvailability(boat.icalUrl);
            console.log(`Events for ${boat.name}:`, events);
            availabilityObj[boat.id] = events;
          } catch (e) {
            availabilityObj[boat.id] = [];
          }
        }
        setAvailabilityData(availabilityObj);
        setBoats(boatsFromFirebase);
      } catch (err) {
        console.error('Error fetching boats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBoats();
  }, []);

  /* ====================================================
     FILTER HANDLER & FILTERED BOATS
  ===================================================== */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Apply search and filter criteria.
  // For boats with iCal, if a date range is selected, only show if available.
  const filteredBoats = boats.filter(boat => {
    const matchesSearch =
      boat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      boat.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filters.type || boat.type === filters.type;
    const matchesLocation = !filters.location || boat.location === filters.location;
    const matchesCompany = !filters.company || boat.company === filters.company;
    const matchesPrice =
      (!filters.minPrice || boat.price >= Number(filters.minPrice)) &&
      (!filters.maxPrice || boat.price <= Number(filters.maxPrice));
    
    // For boats with iCal availability, if dates are chosen, only show if available.
    let matchesAvailability = true;
    if (boat.availabilityType === 'ical' && startDate && endDate) {
      matchesAvailability = isAvailable(startDate, endDate, availabilityData[boat.id]);
    }
    return matchesSearch && matchesType && matchesLocation && matchesCompany && matchesPrice && matchesAvailability;
  });

  /* ====================================================
     RENDERING
  ===================================================== */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Live Partner Boats</h1>
      </div>
      
      {/* Search, Date Range & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search boats..."
              className="w-full p-2 pl-10 border rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 border rounded-lg"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 border rounded-lg"
            />
          </div>
          <Filter className="text-gray-600" size={24} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="p-2 border rounded-lg"
          >
            <option value="">Boat Type</option>
            {[...new Set(boats.map(boat => boat.type))]
              .map((type, index) => (
                <option key={`type-${index}-${type || 'unknown'}`} value={type}>
                  {type || 'Unknown'}
                </option>
              ))}
          </select>
          <select
            name="location"
            value={filters.location}
            onChange={handleFilterChange}
            className="p-2 border rounded-lg"
          >
            <option value="">Location</option>
            {[...new Set(boats.map(boat => boat.location))]
              .map((loc, index) => (
                <option key={`location-${index}-${loc || 'unknown'}`} value={loc}>
                  {loc || 'Unknown'}
                </option>
              ))}
          </select>
          <select
            name="company"
            value={filters.company}
            onChange={handleFilterChange}
            className="p-2 border rounded-lg"
          >
            <option value="">Company</option>
            {[...new Set(boats.map(boat => boat.company))]
              .map((comp, index) => (
                <option key={`company-${index}-${comp || 'unknown'}`} value={comp}>
                  {comp || 'Unknown'}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              name="minPrice"
              placeholder="Min €"
              value={filters.minPrice}
              onChange={handleFilterChange}
              className="p-2 border rounded-lg w-1/2"
            />
            <input
              type="number"
              name="maxPrice"
              placeholder="Max €"
              value={filters.maxPrice}
              onChange={handleFilterChange}
              className="p-2 border rounded-lg w-1/2"
            />
          </div>
        </div>
      </div>
      
      {/* Boat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBoats.map(boat => (
          <div key={boat.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
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
              {/* Display availability badge if date range is selected */}
              {boat.availabilityType === 'ical' && startDate && endDate && (
                <div className="mt-2">
                  <span className={`p-2 rounded ${getAvailabilityStatus(boat, startDate, endDate, availabilityData)?.class}`}>
                    {getAvailabilityStatus(boat, startDate, endDate, availabilityData)?.message}
                  </span>
                </div>
              )}
              <div className="space-y-2 text-gray-600">
                <p className="text-base">
                  <span className="font-medium">Type:</span> {boat.type}
                </p>
                <p className="text-base">
                  <span className="font-medium">Location:</span> {boat.location}
                </p>
                {boat.seasonalPrices ? (
                  <div className="space-y-1">
                    <p className="font-medium">Seasonal Prices:</p>
                    {Object.entries(boat.seasonalPrices).map(([season, price]) => (
                      <p key={season} className="text-sm pl-2">
                        {season}: {price}/day
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-base">
                    <span className="font-medium">Price:</span> {boat.price}€/day
                  </p>
                )}
              </div>
              <div className="mt-4">
                <button
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar size={18} />
                  Check Availability
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filteredBoats.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No boats found matching your criteria.
        </div>
      )}
    </div>
  );
};

export default BoatFinder;
