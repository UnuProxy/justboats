const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Constants
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';
const SENDGRID_MULTI_BOAT_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e'; // Use same template or create a new one
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

// Format multi-boat booking data for email template
function formatMultiBoatEmailData(data) {
  // Check if this is a multi-boat booking
  const isMultiBoat = data.multiBoat || 
                      (data.bookingDetails && data.bookingDetails.multiBoatBooking) || 
                      (data.boats && Array.isArray(data.boats) && data.boats.length > 1);

  if (!isMultiBoat) {
    // Regular single boat booking
    return {
      clientName: data.clientName,
      bookingDate: data.bookingDetails?.date || 'N/A',
      startTime: data.bookingDetails?.startTime || 'N/A',
      endTime: data.bookingDetails?.endTime || 'N/A',
      boatName: data.bookingDetails?.boatName || 'N/A',
      passengers: data.bookingDetails?.passengers || 'N/A',
      totalAmount: data.bookingDetails?.price || 0,
      isMultiBoat: false
    };
  }

  // For multi-boat booking
  const boats = data.boats || [];
  
  // Calculate total passengers and price across all boats
  const totalPassengers = boats.reduce((sum, boat) => sum + parseInt(boat.passengers || 0), 0);
  const totalPrice = boats.reduce((sum, boat) => sum + parseFloat(boat.pricing?.agreedPrice || 0), 0);
  
  // Get the earliest date and time from all boats (they should be the same, but just in case)
  let bookingDate = boats.length > 0 ? boats[0].date : data.bookingDetails?.date || 'N/A';
  let startTime = boats.length > 0 ? boats[0].startTime : data.bookingDetails?.startTime || 'N/A';
  let endTime = boats.length > 0 ? boats[0].endTime : data.bookingDetails?.endTime || 'N/A';
  
  // Generate a formatted list of boats for email display
  const boatsList = boats.map((boat, index) => {
    return {
      number: index + 1,
      name: boat.boatName || `Boat ${index + 1}`,
      passengers: boat.passengers || 'N/A',
      price: boat.pricing?.agreedPrice || 0
    };
  });

  return {
    clientName: data.clientName,
    bookingDate: bookingDate,
    startTime: startTime,
    endTime: endTime,
    totalPassengers: totalPassengers,
    totalAmount: totalPrice.toFixed(2),
    boatCount: boats.length,
    boats: boatsList,
    isMultiBoat: true,
    // Still provide a single boatName for backwards compatibility with template
    boatName: boats.length > 0 
      ? `${boats[0].boatName} + ${boats.length - 1} more` 
      : 'Multiple Boats',
    passengers: totalPassengers.toString()
  };
}

// Callable Function - Updated for multi-boat support
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

    // Check if this is a multi-boat booking
    const isMultiBoat = data.multiBoat || 
                        (data.bookingDetails && data.bookingDetails.multiBoatBooking) || 
                        (data.boats && Array.isArray(data.boats) && data.boats.length > 1);
    
    const templateId = isMultiBoat ? SENDGRID_MULTI_BOAT_TEMPLATE_ID : SENDGRID_TEMPLATE_ID;
    const dynamic_template_data = formatMultiBoatEmailData(data);

    const emailData = {
      to: data.clientEmail,
      from: 'info@justenjoyibiza.com',
      templateId: templateId,
      dynamic_template_data: dynamic_template_data
    };

    await sendEmailDirectApi(emailData);
    
    // Log additional info for multi-boat bookings
    if (isMultiBoat) {
      console.log(`Multi-boat confirmation sent to ${data.clientEmail} for ${dynamic_template_data.boatCount} boats`);
    }
    
    return { success: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// HTTP Endpoint - Updated for multi-boat support
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

    // Check if this is a multi-boat booking
    const isMultiBoat = data.multiBoat || 
                        (data.bookingDetails && data.bookingDetails.multiBoatBooking) || 
                        (data.boats && Array.isArray(data.boats) && data.boats.length > 1);
    
    const templateId = isMultiBoat ? SENDGRID_MULTI_BOAT_TEMPLATE_ID : SENDGRID_TEMPLATE_ID;
    const dynamic_template_data = formatMultiBoatEmailData(data);

    const emailData = {
      to: data.clientEmail,
      from: 'info@justenjoyibiza.com',
      templateId: templateId,
      dynamic_template_data: dynamic_template_data
    };

    await sendEmailDirectApi(emailData);
    res.status(200).send({ success: true });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Booking Document Trigger - Updated for multi-boat support
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

    // Check for multi-boat booking
    const isMultiBoat = booking.isPartOfMultiBoatBooking || false;
    
    // For multi-boat bookings, we need to check if this is the first boat being processed
    if (isMultiBoat) {
      // Get the group ID
      const groupId = booking.multiBoatGroupId;
      
      if (!groupId) {
        console.error('Multi-boat booking missing groupId');
        return null;
      }
      
      // Check if we already processed this group
      const emailSentRef = admin.firestore().collection('multiBoatEmailSent');
      const existingEmail = await emailSentRef.doc(groupId).get();
      
      if (existingEmail.exists) {
        console.log(`Email already sent for multi-boat group ${groupId}`);
        await event.data.ref.update({
          emailSent: true,
          emailSentInGroup: true,
          emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }
      
      // This is the first boat in the group to be processed
      // Fetch all boats in this group
      const groupBookingsSnapshot = await admin.firestore()
        .collection('bookings')
        .where('multiBoatGroupId', '==', groupId)
        .get();
      
      if (groupBookingsSnapshot.empty) {
        console.error(`No bookings found for group ${groupId}`);
        return null;
      }
      
      const boatBookings = groupBookingsSnapshot.docs.map(doc => doc.data());
      
      // Build multi-boat email data
      const emailData = {
        to: booking.clientDetails.email,
        from: 'info@justenjoyibiza.com',
        templateId: SENDGRID_MULTI_BOAT_TEMPLATE_ID,
        dynamic_template_data: formatMultiBoatEmailData({
          clientName: booking.clientDetails.name || 'Guest',
          boats: boatBookings.map(boat => ({
            date: boat.bookingDetails?.date,
            startTime: boat.bookingDetails?.startTime,
            endTime: boat.bookingDetails?.endTime,
            boatName: boat.bookingDetails?.boatName,
            passengers: boat.bookingDetails?.passengers,
            pricing: {
              agreedPrice: boat.pricing?.agreedPrice
            }
          }))
        })
      };
      
      await sendEmailDirectApi(emailData);
      
      // Mark this group as processed
      await emailSentRef.doc(groupId).set({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        clientEmail: booking.clientDetails.email,
        boatCount: boatBookings.length
      });
      
      // Update all boats in the group
      for (const doc of groupBookingsSnapshot.docs) {
        await doc.ref.update({
          emailSent: true,
          emailSentInGroup: true,
          emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      // Handle regular single-boat booking
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
          totalAmount: booking.pricing?.finalPrice || booking.pricing?.agreedPrice || 0,
        },
      };

      await sendEmailDirectApi(emailData);
      await event.data.ref.update({
        emailSent: true,
        emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Booking Trigger Error:', error);
  }
  return null;
});

// Test Endpoint - Updated to support testing multi-boat emails
exports.testEmail = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  secrets: ["SENDGRID_API_KEY"]
}, async (request) => {
  try {
    const testEmail = request.data?.testEmail || "test@example.com";
    const testMultiBoat = request.data?.testMultiBoat || false;
    
    if (!testMultiBoat) {
      // Test single boat email
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
          isMultiBoat: false
        },
      });
    } else {
      // Test multi-boat email
      await sendEmailDirectApi({
        to: testEmail,
        from: 'info@justenjoyibiza.com',
        templateId: SENDGRID_MULTI_BOAT_TEMPLATE_ID,
        dynamic_template_data: formatMultiBoatEmailData({
          clientName: "Test User",
          multiBoat: true,
          boats: [
            {
              date: "2025-03-07",
              startTime: "10:00",
              endTime: "14:00",
              boatName: "Sunseeker 75",
              passengers: "6",
              pricing: { agreedPrice: 1500 }
            },
            {
              date: "2025-03-07",
              startTime: "10:00",
              endTime: "14:00",
              boatName: "Azimut 55",
              passengers: "4",
              pricing: { agreedPrice: 1200 }
            },
            {
              date: "2025-03-07",
              startTime: "10:00",
              endTime: "14:00",
              boatName: "Sea Ray 42",
              passengers: "8",
              pricing: { agreedPrice: 900 }
            }
          ]
        })
      });
    }

    return { 
      success: true, 
      message: `Test ${testMultiBoat ? 'multi-boat' : 'single boat'} email sent to ${testEmail}` 
    };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});


// ────────── NEW! ──────────
// This onRequest endpoint logs the scan and then redirects to wa.me
exports.trackAndRedirect = onRequest({
  region: 'us-central1',
  cors: ALLOWED_ORIGINS
}, async (req, res) => {
  try {
    const placeId = req.query.placeId;
    if (!placeId) {
      return res.status(400).send('Missing placeId');
    }

    const placeRef = db.collection('places').doc(placeId);
    const snap     = await placeRef.get();
    if (!snap.exists) {
      return res.status(404).send('Place not found');
    }
    const place = snap.data();

    await placeRef.update({
      scanCount: admin.firestore.FieldValue.increment(1)
    });
    await db.collection('placeScanEvents').add({
      placeId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.get('User-Agent') || null,
      referrer:  req.get('Referer')   || null
    });

    const cleanNumber = place.whatsappNumber.replace(/\D/g, '');
    const text        = encodeURIComponent(place.whatsappMessage);
    const waUrl       = `https://wa.me/${cleanNumber}?text=${text}`;
    return res.redirect(302, waUrl);

  } catch (err) {
    console.error('trackAndRedirect error:', err);
    // send back the real error message
    return res.status(500).send(`Error: ${err.message}`);
  }
});













  
  

