// Import required dependencies from v2
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const fs = require('fs');
// Updated CORS configuration to explicitly allow your domains
const cors = require('cors')({ 
  origin: ['https://justboats.vercel.app', 'https://justenjoyibizaboats.com', 'http://localhost:3000'], 
  credentials: true 
});
const axios = require('axios');
require('dotenv').config();

// Initialize admin SDK once
admin.initializeApp();

console.log('Firebase Functions initialized');

// Try to load SendGrid API key from runconfig file
let sendgridApiKey = null;
try {
  // Read from runtimeconfig.json (instead of runconfig.json)
  const runtimeConfig = JSON.parse(fs.readFileSync('./runtimeconfig.json', 'utf8'));
  if (runtimeConfig && runtimeConfig.sendgrid && runtimeConfig.sendgrid.key) {
    sendgridApiKey = runtimeConfig.sendgrid.key;
    console.log('Successfully loaded SendGrid API key from runtimeconfig.json file');
  }
} catch (error) {
  console.error('Error loading runtimeconfig.json file:', error.message);
}

// Template ID for SendGrid
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';

// Get API key from multiple sources
function getApiKey() {
  // First try from the runconfig we loaded above
  if (sendgridApiKey) {
    console.log('Using SendGrid API key from runconfig');
    return sendgridApiKey;
  }
  
  // Then try Firebase Function v2 secrets/params
  if (process.env.SENDGRID_API_KEY) {
    console.log('Using SendGrid API key from process.env');
    return process.env.SENDGRID_API_KEY;
  }
  
  if (functions.params && functions.params.SENDGRID_API_KEY) {
    console.log('Using SendGrid API key from Functions v2 params');
    return functions.params.SENDGRID_API_KEY;
  }
  
  if (functions.params && functions.params.sendgrid && functions.params.sendgrid.key) {
    console.log('Using SendGrid API key from Functions v2 named params');
    return functions.params.sendgrid.key;
  }
  
  console.error('SendGrid API key not found. Please configure it in runconfig.json or use Firebase secrets');
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

// IMPORTANT: Keep the original function name to match frontend code
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

// Also create a namespaced version for future use
exports.boatsAppSendBookingConfirmation = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"], 
  region: "us-central1",
  maxInstances: 10
}, async (request) => {
  // Same implementation as above
  if (request.auth) {
    console.log('Auth context:', request.auth.uid);
  } else {
    console.log('No auth context - anonymous call');
  }
  
  const data = request.data;
  console.log('Received data in Cloud Function (boatsApp):', data);

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
    console.error('Error in boatsAppSendBookingConfirmation:', error);
    throw new HttpsError('internal', 'Failed to send email: ' + error.message);
  }
});

// IMPORTANT: Keep the original HTTP function name to match frontend code
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

// Also create a namespaced version for future use
exports.boatsAppSendBookingConfirmationHttp = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  // Same implementation as above
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      console.error('Method Not Allowed:', req.method);
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const data = req.body;
      console.log('Received data in HTTP Function (boatsApp):', data);

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
      console.error('Error in boatsAppSendBookingConfirmationHttp:', error);
      res.status(500).send({ 
        error: 'Failed to send email: ' + error.message,
        details: error.response ? error.response.data : null
      });
    }
  });
});

// Keep original function name for consistency with bookings collection triggers
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

// Namespaced version of the booking notification trigger
exports.boatsAppProcessNewBookingNotification = onDocumentCreated('bookings/{bookingId}', async (event) => {
  // Same implementation as above
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

  console.log('Email template data (boatsApp):', templateData);

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
    console.error('Error in boatsAppProcessNewBookingNotification:', sgError);
    // Still return null to prevent function crash
  }
  return null;
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

// Namespaced version of test email
exports.boatsAppTestEmail = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  // Same implementation as above
  console.log('boatsApp Test email function called');
  
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
    console.error('Error in boatsAppTestEmail:', error);
    throw new HttpsError('internal', 'Failed to send test email: ' + error.message);
  }
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

// Add a few more utility functions

// Simple test email function
exports.testEmailSimple = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  console.log('Test email simple function called');
  return { success: true, message: "This is where an email would be sent" };
});

// Process New Booking Email
exports.processNewBookingEmail = onRequest({
  region: "us-central1",
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"]
}, async (req, res) => {
  console.log('processNewBookingEmail called');
  return cors(req, res, async () => {
    try {
      const bookingData = req.body;
      
      if (!bookingData?.clientDetails?.email || !bookingData?.clientDetails?.name) {
        throw new Error('Missing required client details');
      }
      
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

// Get API Key Details - for debugging only, DO NOT expose in production
exports.getApiKeyDetails = onCall({
  cors: ["https://justboats.vercel.app", "https://justenjoyibizaboats.com", "http://localhost:3000"],
  region: "us-central1"
}, async (request) => {
  // Check auth to ensure this is only callable by authorized users
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'This function requires authentication');
  }
  
  try {
    const apiKey = getApiKey();
    return { 
      hasKey: !!apiKey,
      keyLength: apiKey ? apiKey.length : 0,
      keySource: apiKey ? (
        sendgridApiKey ? 'runconfig' : 
        process.env.SENDGRID_API_KEY ? 'process.env' : 
        'other source'
      ) : 'not found',
      environment: Object.keys(process.env).filter(k => !k.includes('AWS') && !k.includes('GOOGLE'))
    };
  } catch (error) {
    console.error('Error in getApiKeyDetails:', error);
    throw new HttpsError('internal', 'Failed to get API key details: ' + error.message);
  }
});

















  
  

