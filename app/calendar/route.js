// app/api/calendar/route.js
export const runtime = 'edge';

/**
 * Edge function to fetch calendar data without CORS issues
 */
export async function GET(request) {
  // Get URL from query parameters
  const { searchParams } = new URL(request.url);
  const calendarUrl = searchParams.get('url');

  if (!calendarUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing url parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }

  try {
    // Fetch the calendar data from the provided URL
    const response = await fetch(calendarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar fetch failed with status: ${response.status}`);
    }

    const calendarData = await response.text();

    // Verify it's actual iCal data
    if (!calendarData.includes('BEGIN:VCALENDAR') && 
        !calendarData.includes('BEGIN:VEVENT') && 
        !calendarData.includes('BEGIN:VFREEBUSY')) {
      throw new Error('Invalid iCal data received');
    }

    // Return the calendar data with proper CORS headers
    return new Response(
      JSON.stringify({ success: true, data: calendarData }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}