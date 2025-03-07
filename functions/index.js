// Import required dependencies from v2
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
// Updated CORS configuration to explicitly allow your domains
const cors = require('cors')({ 
  origin: ['https://justboats.vercel.app', 'https://justenjoyibizaboats.com', 'http://localhost:3000'], // Added localhost for development
  credentials: true 
});
const axios = require('axios'); // Make sure to install: npm install axios
require('dotenv').config();

// Initialize admin SDK once
admin.initializeApp();

console.log('Firebase Functions initialized');

// Template ID for SendGrid
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';

// Get API key from environment - Improved with better logging
function getApiKey() {
  // Try Firebase Functions v2 params first (recommended approach)
  if (functions.params && functions.params.SENDGRID_API_KEY) {
    console.log('Using SendGrid API key from Functions v2 params');
    return functions.params.SENDGRID_API_KEY;
  }
  
  // Next try Firebase Functions v2 named params
  if (functions.params && functions.params.sendgrid && functions.params.sendgrid.key) {
    console.log('Using SendGrid API key from Functions v2 named params');
    return functions.params.sendgrid.key;
  }
  
  // Next try Firebase config v1 style (legacy)
  if (functions.config && functions.config().sendgrid && functions.config().sendgrid.key) {
    console.log('Using SendGrid API key from Firebase config v1');
    return functions.config().sendgrid.key;
  }
  
  // Finally try process.env (for secrets or .env file)
  const key = process.env.SENDGRID_API_KEY;
  if (key) {
    console.log('Using SendGrid API key from process.env');
    return key;
  }
  
  console.error('SendGrid API key not found in any environment variables');
  return null;
}

// DIRECT API approach with improved error handling
async function sendEmailDirectApi(emailData) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('SendGrid API key not configured. Email cannot be sent.');
    throw new Error('SendGrid API key is not configured');
  }
  
  try {
    console.log('Preparing to send email to:', emailData.to);
    console.log('Template data:', JSON.stringify(emailData.dynamic_template_data));
    
    // Use direct Axios request instead of the SendGrid library
    const response = await axios({
      method: 'post',
      url: 'https://api.sendgrid.com/v3/mail/send',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        personalizations: [{
          to: [{ email: emailData.to }],
          dynamic_template_data: emailData.dynamic_template_data
        }],
        from: { email: emailData.from },
        template_id: emailData.templateId
      }
    });
    
    console.log('Email sent through direct API, status:', response.status);
    return { success: true, status: response.status };
  } catch (error) {
    console.error('Error sending email via direct API:', error.message);
    if (error.response) {
      console.error('API Response Status:', error.response.status, error.response.statusText);
      console.error('API Response Body:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// Function for booking email processing
exports.processNewBookingNotification = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const booking = event.data.data();
  if (!booking) {
    console.error('No booking data found');
    return null;
  }
  
  // Prepare template data
  const templateData = {
    clientName: booking.clientDetails?.name || 'Guest',
    bookingDate: booking.bookingDetails?.date || 'N/A',
    startTime: booking.bookingDetails?.startTime || 'N/A',
    endTime: booking.bookingDetails?.endTime || 'N/A',
    boatName: booking.bookingDetails?.boatName || 'N/A',
    passengers: booking.bookingDetails?.passengers || 'N/A',
    totalAmount: booking.pricing?.finalPrice || 0,
    depositRequired: booking.pricing?.deposit || 0,
  };

  console.log('Email template data:', templateData);

  const emailData = {
    to: booking.clientDetails?.email,
    from: 'info@justenjoyibiza.com',
    templateId: SENDGRID_TEMPLATE_ID,
    dynamic_template_data: templateData,
  };

  try {
    await sendEmailDirectApi(emailData);
    console.log('Email sent successfully to:', booking.clientDetails?.email);
    
    // Update the booking document to mark the email as sent
    await event.data.ref.update({
      emailSent: true,
      emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (sgError) {
    console.error('Error in processNewBookingNotification:', sgError);
    // Still return null to prevent function crash
  }
  return null;
});

// Callable function for booking confirmation
exports.sendBookingConfirmation = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"], 
  region: "us-central1",
  maxInstances: 10
}, async (request) => {
  // Log auth context for debugging
  if (request.auth) {
    console.log('Auth context:', request.auth.uid);
  } else {
    console.log('No auth context - anonymous call');
  }
  
  const data = request.data;
  console.log('Received data in Cloud Function:', data);

  if (!data?.clientName || !data?.clientEmail) {
    console.error('Missing required client details:', data);
    throw new HttpsError('invalid-argument', 'Missing required client details');
  }

  const emailData = {
    to: data.clientEmail,
    from: 'info@justenjoyibiza.com',
    templateId: SENDGRID_TEMPLATE_ID,
    dynamic_template_data: {
      clientName: data.clientName,
      bookingDate: data.bookingDetails?.date || 'N/A',
      startTime: data.bookingDetails?.startTime || 'N/A',
      endTime: data.bookingDetails?.endTime || 'N/A',
      boatName: data.bookingDetails?.boatName || 'N/A',
      passengers: data.bookingDetails?.passengers || 'N/A',
      totalAmount: data.bookingDetails?.price || 0,
    },
  };

  try {
    console.log('Attempting to send email with:', emailData);
    const result = await sendEmailDirectApi(emailData);
    console.log('Email sent successfully');
    return { success: true, result };
  } catch (error) {
    console.error('Error in sendBookingConfirmation:', error);
    throw new HttpsError('internal', 'Failed to send email: ' + error.message);
  }
});

// Alternative HTTP function with better CORS handling
exports.sendBookingConfirmationHttp = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  // Apply CORS middleware properly
  return cors(req, res, async () => {
    // Only allow POST method
    if (req.method !== 'POST') {
      console.error('Method Not Allowed:', req.method);
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const data = req.body;
      console.log('Received data in HTTP Function:', data);

      if (!data?.clientName || !data?.clientEmail) {
        console.error('Missing required client details:', data);
        res.status(400).send({ error: 'Missing required client details' });
        return;
      }

      const emailData = {
        to: data.clientEmail,
        from: 'info@justenjoyibiza.com',
        templateId: SENDGRID_TEMPLATE_ID,
        dynamic_template_data: {
          clientName: data.clientName,
          bookingDate: data.bookingDetails?.date || 'N/A',
          startTime: data.bookingDetails?.startTime || 'N/A',
          endTime: data.bookingDetails?.endTime || 'N/A',
          boatName: data.bookingDetails?.boatName || 'N/A',
          passengers: data.bookingDetails?.passengers || 'N/A',
          totalAmount: data.bookingDetails?.price || 0,
        },
      };

      console.log('Attempting to send email with HTTP function:', emailData);
      await sendEmailDirectApi(emailData);
      console.log('Email sent successfully via HTTP function');
      res.status(200).send({ success: true });
    } catch (error) {
      console.error('Error in sendBookingConfirmationHttp:', error);
      res.status(500).send({ 
        error: 'Failed to send email: ' + error.message,
        details: error.response ? error.response.data : null
      });
    }
  });
});

// Order notification function
exports.orderAlertNotification = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data.data();
  if (!order) {
    console.error('No order data found');
    return null;
  }

  const payload = {
    notification: {
      title: 'New Order Received',
      body: `Delivery Date: ${order.deliveryDate || 'Not specified'}. Check order details.`,
      click_action: 'https://your-admin-dashboard-url.com',
    },
    data: {
      orderId: event.params.orderId,
      deliveryDate: order.deliveryDate || '',
    },
  };

  try {
    const tokensSnapshot = await admin.firestore().collection('admin_tokens').get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    if (tokens.length > 0) {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log('Notification sent successfully:', response);
    } else {
      console.log('No admin tokens found');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
  return null;
});

// Test CORS function with improved logging
exports.testCors = onRequest({
  region: "us-central1",
  cors: true  // Allow all origins for testing
}, async (req, res) => {
  console.log('Test CORS function called');
  console.log('Request origin:', req.headers.origin);
  console.log('Request method:', req.method);
  
  // Apply CORS middleware properly
  return cors(req, res, async () => {
    res.status(200).send({ 
      success: true, 
      message: "CORS is working!",
      headers: {
        origin: req.headers.origin,
        method: req.method
      }
    });
  });
});

// Basic test callable function
exports.testCallable = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  console.log('Test callable function invoked');
  console.log('Request auth:', request.auth ? request.auth.uid : 'No auth');
  return { 
    success: true, 
    message: "Callable function is working!",
    timestamp: new Date().toISOString()
  };
});

// Test email callable function with better logging
exports.testEmail = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  console.log('Test email function called');
  
  try {
    // Allow overriding the test email recipient for testing
    const testEmailRecipient = request.data?.testEmail || "test@example.com";
    console.log('Sending test email to:', testEmailRecipient);
    
    const emailData = {
      to: testEmailRecipient,
      from: 'info@justenjoyibiza.com',
      templateId: SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        clientName: "Test User",
        bookingDate: "2025-03-07",
        startTime: "10:00",
        endTime: "14:00",
        boatName: "Test Boat",
        passengers: "4",
        totalAmount: 500,
      },
    };
    
    const result = await sendEmailDirectApi(emailData);
    console.log('Test email sent successfully');
    return { 
      success: true, 
      result,
      message: `Test email sent to ${testEmailRecipient}`
    };
  } catch (error) {
    console.error('Error in testEmail:', error);
    throw new HttpsError('internal', 'Failed to send test email: ' + error.message);
  }
});

// Simple test email function
exports.testEmailSimple = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  console.log('Test email simple function called');
  return { success: true, message: "This is where an email would be sent" };
});

// Process Booking Email 2025
exports.processBookingEmail2025 = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('processBookingEmail2025 called');
  return cors(req, res, async () => {
    try {
      // Your booking email 2025 implementation here
      // This is a placeholder for your implementation
      console.log('processBookingEmail2025 request:', req.body);
      res.status(200).send({ success: true, message: "Booking email 2025 processed" });
    } catch (error) {
      console.error('Error in processBookingEmail2025:', error);
      res.status(500).send({ error: 'Failed to process booking email 2025' });
    }
  });
});

// Process Booking Email New
exports.processBookingEmailNew = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('processBookingEmailNew called');
  return cors(req, res, async () => {
    try {
      // Your booking email new implementation here
      // This is a placeholder for your implementation
      console.log('processBookingEmailNew request:', req.body);
      res.status(200).send({ success: true, message: "New booking email processed" });
    } catch (error) {
      console.error('Error in processBookingEmailNew:', error);
      res.status(500).send({ error: 'Failed to process new booking email' });
    }
  });
});

// Process New Booking Email
exports.processNewBookingEmail = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('processNewBookingEmail called');
  return cors(req, res, async () => {
    try {
      // Your process new booking email implementation here
      // This is a placeholder for your implementation
      console.log('processNewBookingEmail request:', req.body);
      
      // Extract booking data from request
      const bookingData = req.body;
      
      // Validate required fields
      if (!bookingData?.clientDetails?.email || !bookingData?.clientDetails?.name) {
        throw new Error('Missing required client details');
      }
      
      // Prepare template data
      const templateData = {
        clientName: bookingData.clientDetails?.name || 'Guest',
        bookingDate: bookingData.bookingDetails?.date || 'N/A',
        startTime: bookingData.bookingDetails?.startTime || 'N/A',
        endTime: bookingData.bookingDetails?.endTime || 'N/A',
        boatName: bookingData.bookingDetails?.boatName || 'N/A',
        passengers: bookingData.bookingDetails?.passengers || 'N/A',
        totalAmount: bookingData.pricing?.finalPrice || 0,
        depositRequired: bookingData.pricing?.deposit || 0,
      };
      
      // Send email
      const emailData = {
        to: bookingData.clientDetails.email,
        from: 'info@justenjoyibiza.com',
        templateId: SENDGRID_TEMPLATE_ID,
        dynamic_template_data: templateData,
      };
      
      await sendEmailDirectApi(emailData);
      res.status(200).send({ success: true, message: "New booking email processed" });
    } catch (error) {
      console.error('Error in processNewBookingEmail:', error);
      res.status(500).send({ error: 'Failed to process new booking email: ' + error.message });
    }
  });
});

// Fetch iCal Data
exports.fetchIcalData = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('fetchIcalData called');
  return cors(req, res, async () => {
    try {
      // Your iCal data fetching implementation here
      // This is a placeholder for your implementation
      console.log('fetchIcalData request:', req.body);
      res.status(200).send({ success: true, message: "iCal data fetched" });
    } catch (error) {
      console.error('Error in fetchIcalData:', error);
      res.status(500).send({ error: 'Failed to fetch iCal data' });
    }
  });
});

// New Order Notification
exports.newOrderNotification = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('newOrderNotification called');
  return cors(req, res, async () => {
    try {
      // Your new order notification implementation here
      // This is a placeholder for your implementation
      console.log('newOrderNotification request:', req.body);
      res.status(200).send({ success: true, message: "Order notification sent" });
    } catch (error) {
      console.error('Error in newOrderNotification:', error);
      res.status(500).send({ error: 'Failed to send order notification' });
    }
  });
});

// New Order Notify New
exports.newOrderNotifyNew = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('newOrderNotifyNew called');
  return cors(req, res, async () => {
    try {
      // Your new order notify new implementation here
      // This is a placeholder for your implementation
      console.log('newOrderNotifyNew request:', req.body);
      res.status(200).send({ success: true, message: "New order notification sent" });
    } catch (error) {
      console.error('Error in newOrderNotifyNew:', error);
      res.status(500).send({ error: 'Failed to send new order notification' });
    }
  });
});

















  
  

