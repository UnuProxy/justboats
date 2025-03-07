const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp();

// Constants
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';
const ALLOWED_ORIGINS = [
  'https://justboats.vercel.app',
  'https://justenjoyibizaboats.com',
  'http://localhost:3000'
];

// Simplified API key handling using Firebase Secrets
function getApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key not configured in environment variables');
  }
  return apiKey;
}

// Email sending function
async function sendEmailDirectApi(emailData) {
  const apiKey = getApiKey();
  
  try {
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

    return { success: true, status: response.status };
  } catch (error) {
    console.error('SendGrid Error:', error.response?.data);
    throw new Error(`SendGrid API Error: ${error.message}`);
  }
}

// Callable Function
exports.sendBookingConfirmation = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  secrets: ["SENDGRID_API_KEY"],
  maxInstances: 10
}, async (request) => {
  try {
    const data = request.data;
    
    if (!data?.clientName || !data?.clientEmail) {
      throw new HttpsError('invalid-argument', 'Missing client details');
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
    return { success: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// HTTP Endpoint
exports.sendBookingConfirmationHttp = onRequest({
  region: "us-central1",
  cors: ALLOWED_ORIGINS,
  secrets: ["SENDGRID_API_KEY"]
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const data = req.body;
    
    if (!data?.clientName || !data?.clientEmail) {
      res.status(400).send({ error: 'Missing client details' });
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
    res.status(500).send({ error: error.message });
  }
});

// Booking Document Trigger
exports.processNewBookingNotification = onDocumentCreated('bookings/{bookingId}', {
  secrets: ["SENDGRID_API_KEY"],
  region: "us-central1"
}, async (event) => {
  try {
    const booking = event.data.data();
    
    if (!booking?.clientDetails?.email) {
      console.error('Invalid booking data');
      return null;
    }

    const emailData = {
      to: booking.clientDetails.email,
      from: 'info@justenjoyibiza.com',
      templateId: SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        clientName: booking.clientDetails?.name || 'Guest',
        bookingDate: booking.bookingDetails?.date || 'N/A',
        startTime: booking.bookingDetails?.startTime || 'N/A',
        endTime: booking.bookingDetails?.endTime || 'N/A',
        boatName: booking.bookingDetails?.boatName || 'N/A',
        passengers: booking.bookingDetails?.passengers || 'N/A',
        totalAmount: booking.pricing?.finalPrice || 0,
      },
    };

    await sendEmailDirectApi(emailData);
    await event.data.ref.update({
      emailSent: true,
      emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Booking Trigger Error:', error);
  }
  return null;
});

// Test Endpoint
exports.testEmail = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  secrets: ["SENDGRID_API_KEY"]
}, async (request) => {
  try {
    const testEmail = request.data?.testEmail || "test@example.com";
    
    await sendEmailDirectApi({
      to: testEmail,
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
    });

    return { success: true, message: `Test email sent to ${testEmail}` };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

















  
  

