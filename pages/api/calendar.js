// File: pages/api/calendar.js

import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  console.log(`Fetching calendar data from: ${url}`);
  
  try {
    // Fetch the calendar data
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BoatCalendarBot/1.0)',
        'Accept': 'text/calendar, text/plain, */*'
      },
      timeout: 15000 // 15 seconds timeout
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch calendar data: ${response.statusText}`,
        status: response.status
      });
    }
    
    // Get the raw iCal data
    const icalData = await response.text();
    
    // Basic validation to ensure we got actual calendar data
    if (!icalData.includes('BEGIN:VCALENDAR') && !icalData.includes('BEGIN:VEVENT') && !icalData.includes('BEGIN:VFREEBUSY')) {
      console.error('Received invalid iCal data');
      return res.status(400).json({ error: 'Invalid iCal data received' });
    }
    
    // Parse iCal data to extract events
    const events = parseICalData(icalData);
    console.log(`Parsed ${events.length} events from calendar data`);
    
    // Return both raw data and parsed events
    return res.status(200).json({
      events: events,
      data: icalData
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}

// Helper function to parse iCal data
function parseICalData(icalData) {
  // Function to safely parse dates from iCal format
  const safeParseDate = (dateStr) => {
    try {
      if (!dateStr) return null;
      
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
      // Try standard date parsing for other formats
      else {
        parsedDate = new Date(dateStr);
      }
      
      // Validate if parsedDate is valid
      if (isNaN(parsedDate.getTime())) {
        console.warn(`Failed to parse date: ${dateStr}`);
        return null;
      }
      
      return parsedDate;
    } catch (error) {
      console.warn(`Error parsing date '${dateStr}':`, error.message);
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
    console.error("Error parsing iCal data:", err);
    return [];
  }
}