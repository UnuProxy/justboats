// pages/api/test.js
export default function handler(req, res) {
    // Return a simple JSON response
    res.status(200).json({ 
      status: 'ok',
      message: 'API is working!',
      timestamp: new Date().toISOString()
    });
  }