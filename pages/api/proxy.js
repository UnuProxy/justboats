// pages/api/ical-proxy.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        console.log('Fetching calendar from:', decodeURIComponent(url));
        const response = await fetch(decodeURIComponent(url));
        
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