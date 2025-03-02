// pages/api/google-calendar-proxy.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  
    const { calendarId } = req.query;
    if (!calendarId) {
      return res.status(400).json({ error: 'Calendar ID is required' });
    }
  
    try {
      // Try multiple URL formats with proper encoding
      const urlFormats = [
        `https://calendar.google.com/calendar/u/0/ical/${encodeURIComponent(calendarId)}/public/basic.ics`,
        `https://www.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`,
        `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`
      ];
  
      let calendarData = null;
  
      for (const url of urlFormats) {
        try {
          console.log('Attempting fetch from:', url);
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CalendarBot/1.0)',
              'Accept': 'text/calendar,text/x-vcalendar,application/calendar'
            },
            redirect: 'follow'
          });
  
          const data = await response.text();
  
          if (data.trim().startsWith('<!DOCTYPE html>')) {
            console.warn('Received HTML content from:', url);
            continue; // try next URL format
          }
  
          if (data.includes('BEGIN:VCALENDAR')) {
            calendarData = data;
            break;
          }
        } catch (fetchError) {
          console.error('Failed to fetch from URL:', url, fetchError);
        }
      }
  
      if (!calendarData) {
        throw new Error('Could not fetch valid iCal data from any URL format. Ensure the calendar is public.');
      }
  
      res.setHeader('Content-Type', 'text/calendar');
      res.status(200).send(calendarData);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({
        error: error.message,
        details: 'Make sure the calendar is public and the URL is correct.'
      });
    }
  }
  