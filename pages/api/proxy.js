// pages/api/ical-proxy.js
const ALLOWED_CALENDAR_HOSTS = new Set(['calendar.google.com']);

function ensureAllowedUrl(url) {
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const targetUrl = ensureAllowedUrl(decodeURIComponent(url));
        console.log('Fetching calendar from:', targetUrl);
        const response = await fetch(targetUrl);
        
        if (!response.ok) {
            throw new Error(`Calendar fetch failed: ${response.status}`);
        }
        
        const data = await response.text();
        
        // Add debug logging
        console.log('Calendar data received, length:', data.length);
        console.log('First 200 chars:', data.substring(0, 200));
        
        res.setHeader('Content-Type', 'text/calendar');
        res.status(200).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
}
