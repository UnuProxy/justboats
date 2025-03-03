// pages/api/calendar-proxy.js
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
    // Get calendar ID from query
    const { calendarId } = req.query;
    
    if (!calendarId) {
      return res.status(400).json({ error: 'Missing calendarId parameter' });
    }
    
    // Construct Google Calendar URL (simplest approach)
    const calendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics?nocache=${Date.now()}`;
    
    console.log('Fetching calendar from:', calendarUrl);
    
    // Make the request without any custom headers that might trigger CORS issues
    const response = await fetch(calendarUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }
    
    // Get the data as text
    const calendarData = await response.text();
    
    // Very basic validation
    if (!calendarData.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid calendar data received');
    }
    
    // Return as JSON
    return res.status(200).json({
      success: true,
      data: calendarData
    });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(500).json({
      error: error.message
    });
  }
}
  