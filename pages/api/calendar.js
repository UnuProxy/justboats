// pages/api/calendar.js - For Next.js Pages Router
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get parameters from query
    const { url, calendarId } = req.query;
    
    let calendarUrl;
    
    // Determine what URL to fetch
    if (url) {
      // Direct URL provided
      calendarUrl = decodeURIComponent(url);
    } else if (calendarId) {
      // Google Calendar ID provided
      const encodedId = encodeURIComponent(calendarId);
      calendarUrl = `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
    } else {
      return res.status(400).json({
        error: 'Missing URL or calendarId parameter'
      });
    }
    
    // Add cache-busting parameter if not already present
    if (!calendarUrl.includes('nocache=')) {
      const separator = calendarUrl.includes('?') ? '&' : '?';
      calendarUrl = `${calendarUrl}${separator}nocache=${Date.now()}`;
    }
    
    console.log(`Fetching calendar from: ${calendarUrl}`);
    
    // Use node-fetch with appropriate headers
    const response = await fetch(calendarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 BoatFinder/1.0',
        'Accept': 'text/calendar, text/plain, */*'
        // Important: Don't include Cache-Control header here
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    // Get the raw iCal data
    const icalData = await response.text();

    // Verify we got real iCal data, not an error page
    const isValidData = 
      icalData.includes('BEGIN:VCALENDAR') || 
      icalData.includes('BEGIN:VEVENT') || 
      icalData.includes('BEGIN:VFREEBUSY');
    
    if (!isValidData) {
      console.error('Invalid data received:', icalData.substring(0, 200));
      throw new Error('Invalid iCal data received');
    }

    // Return the calendar data
    return res.status(200).json({
      success: true,
      data: icalData
    });
  } catch (error) {
    console.error(`Calendar fetch error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      details: 'Failed to fetch calendar data. Ensure the calendar is public.'
    });
  }
}
