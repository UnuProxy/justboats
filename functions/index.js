// Import required dependencies from v2
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
// Updated CORS configuration to explicitly allow your Vercel domain
const cors = require('cors')({ 
  origin: ['https://justboats.vercel.app', 'https://justenjoyibizaboats.com'],
  credentials: true 
});
const axios = require('axios'); // Make sure to install: npm install axios
require('dotenv').config();

// Initialize admin SDK once
admin.initializeApp();

console.log('Firebase Functions initialized');

// Template ID for SendGrid
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';

// Get API key from environment - DO NOT hardcode in the file
function getApiKey() {
  // Try Firebase config first (v1 style)
  if (functions.config && functions.config().sendgrid && functions.config().sendgrid.key) {
    return functions.config().sendgrid.key;
  }
  
  // Next try v2 params
  if (functions.params && functions.params.sendgrid && functions.params.sendgrid.key) {
    return functions.params.sendgrid.key;
  }
  
  // Finally try process.env 
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.error('SendGrid API key not found in environment variables');
    return null;
  }
  return key;
}

// DIRECT API approach instead of using the SendGrid library
async function sendEmailDirectApi(emailData) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('SendGrid API key is not configured');
  }
  
  try {
    console.log('Preparing to send email to:', emailData.to);
    
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
      console.error('API Response:', error.response.data);
    }
    throw error;
  }
}

// NEW function name for booking email processing
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
  }
  return null;
});

// Keep original function name to match frontend code - UPDATED with explicit CORS settings
exports.sendBookingConfirmation = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"], 
  region: "us-central1", // Specify region for consistency
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

// Alternative HTTP function
exports.sendBookingConfirmationHttp = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  // Apply CORS middleware properly
  return cors(req, res, async () => {
    // Only allow POST method
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const data = req.body;
      console.log('Received data in HTTP Function:', data);

      if (!data?.clientName || !data?.clientEmail) {
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

      await sendEmailDirectApi(emailData);
      res.status(200).send({ success: true });
    } catch (error) {
      console.error('Error in sendBookingConfirmationHttp:', error);
      res.status(500).send({ error: 'Failed to send email: ' + error.message });
    }
  });
});

// New function name for order notification to avoid conflicts
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

// Test CORS function
exports.testCors = onRequest({
  region: "us-central1",
  cors: true  // Allow all origins for testing
}, async (req, res) => {
  // Apply CORS middleware properly
  return cors(req, res, async () => {
    console.log('Test CORS function called');
    res.status(200).send({ success: true, message: "CORS is working!" });
  });
});

// Basic test callable function
exports.testCallable = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"],
  region: "us-central1"
}, async (request) => {
  return { success: true, message: "Callable function is working!" };
});

// Test email callable function
exports.testEmail = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"],
  region: "us-central1"
}, async (request) => {
  try {
    const emailData = {
      to: "test@example.com", // For testing only
      from: 'info@justenjoyibiza.com',
      templateId: SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        clientName: "Test User",
        bookingDate: "2023-01-01",
        startTime: "10:00",
        endTime: "14:00",
        boatName: "Test Boat",
        passengers: "4",
        totalAmount: 500,
      },
    };
    
    const result = await sendEmailDirectApi(emailData);
    return { success: true, result };
  } catch (error) {
    console.error('Error in testEmail:', error);
    throw new HttpsError('internal', 'Failed to send test email: ' + error.message);
  }
});

// Simple test email function
exports.testEmailSimple = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"],
  region: "us-central1"
}, async (request) => {
  return { success: true, message: "This is where an email would be sent" };
});

// Process Booking Email 2025
exports.processBookingEmail2025 = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your booking email 2025 implementation here
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
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your booking email new implementation here
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
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your process new booking email implementation here
      res.status(200).send({ success: true, message: "New booking email processed" });
    } catch (error) {
      console.error('Error in processNewBookingEmail:', error);
      res.status(500).send({ error: 'Failed to process new booking email' });
    }
  });
});

// Fetch iCal Data
exports.fetchIcalData = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your iCal data fetching implementation here
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
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your new order notification implementation here
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
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com"]
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Your new order notify new implementation here
      res.status(200).send({ success: true, message: "New order notification sent" });
    } catch (error) {
      console.error('Error in newOrderNotifyNew:', error);
      res.status(500).send({ error: 'Failed to send new order notification' });
    }
  });
});

















  
  

