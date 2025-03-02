// File: pages/api/calendar.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  console.log(`Fetching calendar data from: ${url}`);

  try {
    // Fetch the calendar data without timeout
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BoatCalendarBot/1.0)',
        'Accept': 'text/calendar, text/plain, */*'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch calendar data: ${response.statusText}`,
        status: response.status
      });
    }

    const icalData = await response.text();

    if (!icalData.includes('BEGIN:VCALENDAR')) {
      console.error('Received invalid iCal data');
      return res.status(400).json({ error: 'Invalid iCal data received' });
    }

    const events = parseICalData(icalData);
    console.log(`Parsed ${events.length} events from calendar data`);

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
  const safeParseDate = (dateStr) => {
    try {
      if (!dateStr) return null;
      if (dateStr.includes('T') && dateStr.includes('Z')) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(9, 11);
        const minute = dateStr.substring(11, 13);
        const second = dateStr.substring(13, 15);
        return new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        ));
      } else if (dateStr.length === 8 && !dateStr.includes('T')) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10)
        ));
      } else {
        const parsedDate = new Date(dateStr);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
    } catch (error) {
      console.warn(`Error parsing date '${dateStr}':`, error.message);
      return null;
    }
  };

  if (!icalData || icalData.length === 0) return [];

  try {
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
          const ranges = line.substring(line.indexOf(':') + 1).split(',');
          ranges.forEach(range => {
            const [startStr, endStr] = range.split('/');
            const start = safeParseDate(startStr);
            const end = safeParseDate(endStr);
            if (start && end) busyPeriods.push({ start, end });
          });
        }
      }
      return busyPeriods;
    }

    const events = [];
    const lines = icalData.split('\n');
    let currentEvent = null;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].trim();
      }
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { transparent: false };
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.start && currentEvent.end && !currentEvent.transparent) {
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (line.startsWith('DTSTART')) {
          currentEvent.start = safeParseDate(line.substring(line.indexOf(':') + 1));
        } else if (line.startsWith('DTEND')) {
          currentEvent.end = safeParseDate(line.substring(line.indexOf(':') + 1));
        } else if (line.startsWith('TRANSP')) {
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
