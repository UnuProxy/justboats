// app/api/calendar/route.js
export const runtime = 'edge';

const ALLOWED_CALENDAR_HOSTS = new Set(['calendar.google.com']);

function ensureAllowedCalendarUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error('Invalid calendar URL');
  }

  if (!ALLOWED_CALENDAR_HOSTS.has(parsed.hostname)) {
    throw new Error('Calendar host is not allowed');
  }

  return parsed.toString();
}

/**
 * Reliable Edge function to fetch calendar data without CORS issues
 */
export async function GET(request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  };

  try {
    // Get URL from query parameters
    const { searchParams } = new URL(request.url);
    let calendarUrl = searchParams.get('url');
    
    // If no URL is provided, check for calendarId
    if (!calendarUrl) {
      const calendarId = searchParams.get('calendarId');
      if (!calendarId) {
        return new Response(
          JSON.stringify({ error: 'Missing url or calendarId parameter' }),
          { status: 400, headers }
        );
      }
      
      // Create Google Calendar URL from ID
      let encodedId = encodeURIComponent(calendarId);
      calendarUrl = `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
    }
    
    // Add cache-busting parameter if not already present
    if (!calendarUrl.includes('nocache=')) {
      const separator = calendarUrl.includes('?') ? '&' : '?';
      calendarUrl = `${calendarUrl}${separator}nocache=${Date.now()}`;
    }
    
    calendarUrl = ensureAllowedCalendarUrl(calendarUrl);

    console.log(`Fetching calendar data from: ${calendarUrl}`);
    
    // Fetch the calendar data with multiple retries
    let response = null;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        response = await fetch(calendarUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BoatFinder/1.0)',
            'Accept': 'text/calendar, text/plain, */*',
            // Important: do NOT include Cache-Control here as it can trigger CORS preflight
            // The cache-busting is handled via the URL parameter
          },
          redirect: 'follow',
          cache: 'no-store' // Bypass browser cache
        });
        
        if (response.ok) break;
        
        console.log(`Retry ${retries + 1}/${maxRetries} failed with status: ${response.status}`);
        retries++;
        
        // Use exponential backoff for retries
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
      } catch (fetchError) {
        console.error(`Fetch attempt ${retries + 1} failed:`, fetchError);
        retries++;
        
        if (retries >= maxRetries) throw fetchError;
        
        // Wait before retrying
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
      }
    }
    
    if (!response.ok) {
      throw new Error(`Calendar fetch failed with status: ${response.status}`);
    }

    const calendarData = await response.text();
    
    // Verify it's actual iCal data using more flexible checking
    const isCalendarData = 
      calendarData.includes('BEGIN:VCALENDAR') || 
      calendarData.includes('BEGIN:VEVENT') || 
      calendarData.includes('BEGIN:VFREEBUSY');
    
    if (!isCalendarData) {
      console.error('Invalid calendar data received:', calendarData.substring(0, 100) + '...');
      throw new Error('Invalid iCal data received');
    }

    return new Response(
      JSON.stringify({ success: true, data: calendarData }),
      { status: 200, headers }
    );
    
  } catch (error) {
    console.error('Calendar proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to fetch calendar data. Please ensure the calendar is public and correctly configured.'
      }),
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    }
  });
}
