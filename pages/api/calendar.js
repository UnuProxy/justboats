// pages/api/calendar.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract the calendar URL from the request
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: 'Missing URL parameter'
    });
  }

  try {
    // Clean and decode the URL
    const decodedUrl = decodeURIComponent(url);
    
    // Add Cache-Control header to avoid caching
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 BoatFinder/1.0',
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    // Get the raw iCal data
    const icalData = await response.text();

    // Verify we got real iCal data, not an error page
    if (!icalData.includes('BEGIN:VCALENDAR') && !icalData.includes('BEGIN:VEVENT') && !icalData.includes('BEGIN:VFREEBUSY')) {
      throw new Error('Invalid iCal data received');
    }

    // Return the calendar data
    return res.status(200).json({
      success: true,
      data: icalData,
      // You could also parse events here on the server side if desired
    });
  } catch (error) {
    console.error(`Calendar fetch error: ${error.message}`);
    return res.status(500).json({
      error: error.message
    });
  }
}
