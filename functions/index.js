// Import the v2 APIs for Firestore and HTTPS triggers
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest } = require('firebase-functions/v2/https');

// Import and initialize the admin SDK
const admin = require('firebase-admin');
admin.initializeApp();

// Import firebase-functions (for errors and logging)
const functions = require('firebase-functions');

// Import and configure SendGrid using functions config with a fallback to environment variable
const sgMail = require('@sendgrid/mail');


// Try to get the SendGrid key from functions config
const sendGridConfig = functions.config().sendgrid || {};
const sendGridApiKey = sendGridConfig.key || sendGridConfig.api_key || process.env.SENDGRID_API_KEY;

if (!sendGridApiKey) {
  throw new Error(
    'SendGrid API key is missing. Set it via "firebase functions:config:set sendgrid.key=YOUR_SENDGRID_API_KEY" or set the SENDGRID_API_KEY environment variable.'
  );
}

sgMail.setApiKey(sendGridApiKey);
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';

// ------------------------------
// HTTP Endpoint for Health Check
// ------------------------------
exports.healthCheck = onRequest((req, res) => {
  // This endpoint ensures the container is listening on PORT 8080 for Cloud Run health checks.
  res.status(200).send('OK');
});

// -------------------------------------------------
// Firestore Trigger: Process New Booking Email
// -------------------------------------------------
exports.processNewBookingEmail = onDocumentCreated('bookings/{bookingId}', async (event) => {
  try {
    const booking = event.data.data();
    if (!booking) {
      console.error('No booking data found');
      return null;
    }

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

    console.log('SendGrid message data:', emailData);

    try {
      await sgMail.send(emailData);
      console.log('Email sent successfully to:', booking.clientDetails?.email);

      // Mark the booking as having been emailed
      await event.data.ref.update({
        emailSent: true,
        emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (sgError) {
      console.error('SendGrid Error:', sgError);
      if (sgError.response) {
        console.error('SendGrid Error Body:', sgError.response.body);
      }
      throw sgError;
    }
    return null;
  } catch (error) {
    console.error('Error processing email:', error);
    throw error;
  }
});

// -------------------------------------------------
// Callable Function: Send Booking Confirmation Email
// -------------------------------------------------
exports.sendBookingConfirmation = onCall({ cors: true }, async (request) => {
  const data = request.data;
  console.log('Received data in Cloud Function:', data);

  // Validate required fields
  if (!data?.clientName || !data?.clientEmail) {
    console.error('Missing fields:', { name: data?.clientName, email: data?.clientEmail });
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required client details'
    );
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
      totalAmount: data.bookingDetails?.price || 0
    },
  };

  try {
    console.log('Attempting to send email with:', emailData);
    await sgMail.send(emailData);
    console.log('Email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error('SendGrid Error Body:', error.response.body);
    }
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send email: ' + error.message
    );
  }
});

// -------------------------------------------------
// Firestore Trigger: New Order Notification
// -------------------------------------------------
exports.newOrderNotification = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data.data();
  if (!order) {
    console.error('No order data found');
    return null;
  }

  const payload = {
    notification: {
      title: 'New Order Received',
      body: `Delivery Date: ${order.deliveryDate || 'Not specified'}. Check order details.`,
      click_action: 'https://your-admin-dashboard-url.com', // Update as needed
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


















  
  

