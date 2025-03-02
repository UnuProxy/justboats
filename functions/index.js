

// Import required dependencies from v2
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
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

// Keep original function name to match frontend code
exports.sendBookingConfirmation = onCall({
  cors: true,
  maxInstances: 10
}, async (request) => {
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
  cors: true
}, async (req, res) => {
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

















  
  

