// pages/api/ical-proxy.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
  
    try {
      const decodedUrl = decodeURIComponent(url);
      console.log('Fetching calendar from:', decodedUrl);
      const response = await fetch(decodedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
  
      if (!response.ok) {
        throw new Error(`Calendar fetch failed with status: ${response.status}`);
      }
  
      const data = await response.text();
  
      // Detect if returned content is HTML
      if (data.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('Received HTML content instead of iCal data. Check that the calendar is public and the URL is correct.');
      }
  
      console.log('Calendar data received, length:', data.length);
      console.log('First 200 chars:', data.substring(0, 200));
  
      if (!data.includes('BEGIN:VCALENDAR')) {
        throw new Error('Invalid iCal data received');
      }
  
      res.setHeader('Content-Type', 'text/calendar');
      res.status(200).send(data);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  