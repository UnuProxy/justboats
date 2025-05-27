const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const { getMessaging } = require('firebase-admin/messaging');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Constants
const SENDGRID_ORDER_NOTIFICATION_TEMPLATE_ID = 'd-19b8a21dc04c4c8aa3171f6faf5de453';
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';
const SENDGRID_MULTI_BOAT_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e'; // Use same template or create a new one
const ALLOWED_ORIGINS = [
  'https://justboats.vercel.app',
  'https://justenjoyibizaboats.com',
  'http://localhost:3000'
];
const ADMIN_EMAIL = 'unujulian@gmail.com';
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

exports.trackAndRedirect = onRequest({
  region: 'us-central1',
  cors: ALLOWED_ORIGINS,
  maxInstances: 10
}, async (req, res) => {
  try {
    // Accept parameters from QR code
    const locationId = req.query.locationId || 'DEFAULT';
    const category = req.query.category || '';
    const location = req.query.location || '';
    const directName = req.query.name || '';
    
    console.log('QR SCAN - Received locationId:', locationId);
    console.log('QR SCAN - Category:', category);
    console.log('QR SCAN - Direct name from URL:', directName);
    
    // Initialize variables
    let locationName = directName; // Start with the name from URL
    let promoCode = '';
    
    try {
      // CRITICAL FIX: Lookup the location document to get its name
      console.log('Fetching location document from scanLocations collection with id:', locationId);
      
      const locationDoc = await db.collection('scanLocations').doc(locationId).get();
      
      if (locationDoc.exists) {
        // Document exists, get the name field
        const docData = locationDoc.data();
        console.log('Document data retrieved:', docData);
        
        // Use the name from database if available
        if (docData.name) {
          locationName = docData.name;
          console.log('Using location name from database:', locationName);
        } else {
          console.log('Location document exists but has no name field');
        }
        
        // Update scan count
        await db.collection('scanLocations').doc(locationId).update({
          scanCount: admin.firestore.FieldValue.increment(1)
        });
        console.log('Updated scan count for location');
      } else {
        console.log('No document found with that ID in scanLocations collection');
      }
    } catch (fetchError) {
      console.error('Error fetching location document:', fetchError);
    }
    
    // Ensure we have a location name even if lookup failed
    if (!locationName) {
      locationName = 'our QR code';
      console.log('Using default location name after failed lookup');
    }
    
    // Generate promo code based on location name
    try {
      const cleanName = locationName.toUpperCase()
        .replace(/[^A-Z0-9]/g, '')  // Remove any non-alphanumeric chars
        .slice(0, 8);  // Take up to 8 chars to keep code reasonable length
      
      const randomDigits = Math.floor(100 + Math.random() * 900); // 100-999
      promoCode = `CAVA-${cleanName}${randomDigits}`;
      console.log('Generated promo code:', promoCode);
    } catch (codeError) {
      // Fallback for promo code
      const shortId = locationId.slice(0, 5).toUpperCase();
      promoCode = `CAVA-${shortId}${Math.floor(100 + Math.random() * 900)}`;
      console.log('Used fallback promo code generation:', promoCode);
    }
    
    // Log the scan event WITH the location name
    try {
      const eventData = {
        locationId: locationId,
        locationName: locationName, 
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        promoCode: promoCode,
        userAgent: req.headers['user-agent'] || '',
        category: category,
        location: location
      };
      
      console.log('Logging scan event with data:', eventData);
      await db.collection('locationScanEvents').add(eventData);
      console.log('Successfully logged scan event with location name');
    } catch (logError) {
      console.error('Error logging scan event:', logError);
    }
    
    // Build redirect URL with the promo code and location name
    let redirectUrl = `https://www.justenjoyibizaboats.com/yacht-rental.html?promo=${promoCode}`;
    redirectUrl += `&placeName=${encodeURIComponent(locationName)}`;
    
    if (category) {
      redirectUrl += `&category=${encodeURIComponent(category)}`;
    }
    
    console.log('Redirecting to:', redirectUrl);
    
    // IMPROVED REDIRECT with better localStorage handling
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to Just Enjoy Ibiza Boats</title>
        <meta http-equiv="refresh" content="2;url=${redirectUrl}">
        <script>
          // Store values in localStorage with an expiration date (7 days)
          function setWithExpiry(key, value, ttl) {
            const now = new Date();
            const item = {
              value: value,
              expiry: now.getTime() + ttl,
            };
            localStorage.setItem(key, JSON.stringify(item));
          }
          
          // Set promo code and source with 7-day expiration
          setWithExpiry('autoPromoCode', '${promoCode}', 7 * 24 * 60 * 60 * 1000);
          setWithExpiry('promoPlaceName', '${encodeURIComponent(locationName)}', 7 * 24 * 60 * 60 * 1000);
          
          // Also set as regular localStorage items for backward compatibility
          localStorage.setItem('autoPromoCode', '${promoCode}');
          localStorage.setItem('promoPlaceName', '${encodeURIComponent(locationName)}');
          
          // For debugging - this will show in console when user arrives
          console.log('QR scan redirect: Storing promo code ${promoCode} from ${locationName}');
          
          // Redirect with a slight delay to ensure storage is complete
          setTimeout(function() {
            window.location.href = "${redirectUrl}";
          }, 500);
        </script>
      </head>
      <body>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
          <div style="text-align: center;">
            <p>Loading your special offer...</p>
            <p>If you are not redirected, <a href="${redirectUrl}">click here</a>.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('REDIRECT - Unhandled error:', error);
    res.redirect(302, 'https://www.justenjoyibizaboats.com/yacht-rental.html');
  }
});

// Function to track when users interact with the yacht rental page
exports.recordPlaceConversion = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  maxInstances: 10
}, async (request) => {
  try {
    const data = request.data;
    
    if (!data?.placeId) {
      throw new HttpsError('invalid-argument', 'Missing place ID');
    }

    const placeId = data.placeId;
    const boatName = data.boatName || null; // Which boat they're interested in
    const userInfo = data.userInfo || {}; // Optional - collect name, email, etc.
    
    // Get the place data
    const placeRef = db.collection('boatCatalogs').doc(placeId);
    const place = await placeRef.get();
    
    if (!place.exists) {
      throw new HttpsError('not-found', 'Place not found');
    }
    
    // Record the conversion event
    await db.collection('placeConversionEvents').add({
      placeId: placeId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.rawRequest.headers['user-agent'] || 'Unknown',
      boatName: boatName,
      userInfo: userInfo,
      source: 'yacht-rental-website'
    });
    
    // Update conversion count on the place document
    await placeRef.update({
      conversionCount: admin.firestore.FieldValue.increment(1)
    });
    
    // Update the most recent scan event for this catalog to mark it as converted
    const recentScanQuery = db.collection('catalogScanEvents')
      .where('catalogId', '==', placeId)
      .orderBy('timestamp', 'desc')
      .limit(1);
    
    const scanEvents = await recentScanQuery.get();
    if (!scanEvents.empty) {
      await scanEvents.docs[0].ref.update({
        converted: true
      });
    }
    
    // Return the WhatsApp URL and message to the client
    // If your yacht rental page handles this directly, you might not need this part
    const placeData = place.data();
    const cleanNumber = placeData.whatsappNumber ? placeData.whatsappNumber.replace(/\D/g, '') : '34123456789'; // Default if not set
    const text = placeData.whatsappMessage ? 
      encodeURIComponent(placeData.whatsappMessage) : 
      encodeURIComponent(`Hello, I'm interested in renting a boat from Just Enjoy Ibiza Boats!`);
    
    const waUrl = `https://wa.me/${cleanNumber}?text=${text}`;
    
    return { 
      success: true,
      whatsappUrl: waUrl
    };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

function formatOrderNotificationData(order, orderId) {
  const orderNumber = order.orderId || orderId.slice(-6);
  const customerName = order.fullName || 'Unknown Customer';
  const boatName = order.boatName || 'Unknown Boat';
  const totalAmount = (order.amount_total || 0).toFixed(2);
  const itemCount = order.items ? order.items.length : 0;
  
  // Format items for template
  let formattedItems = [];
  if (order.items && order.items.length > 0) {
    formattedItems = order.items.map(item => ({
      name: item.name || 'Item',
      quantity: item.quantity || 1,
      price: (item.price || 0).toFixed(2),
      itemTotal: ((item.price || 0) * (item.quantity || 1)).toFixed(2)
    }));
  }

  // Check if there are special instructions (based on your actual fields)
  const hasSpecialInstructions = !!(
    order.specialNotes || 
    order.deliveryInstructions
  );

  return {
    // Header information
    orderNumber: orderNumber,
    totalAmount: totalAmount,
    itemCount: itemCount,
    timestamp: new Date().toLocaleString(),
    
    // Customer information (based on your database fields)
    customerName: customerName,
    boatName: boatName,
    customerEmail: order.customerEmail || 'Not provided',
    phoneNumber: order.phoneNumber || 'Not provided',
    rentalCompany: order.rentalCompany || 'Not provided',
    orderDate: order.orderDate || new Date().toLocaleDateString(),
    orderSource: order.orderSource || 'Unknown',
    paymentMethod: order.paymentMethod || 'Not specified',
    paymentStatus: order.paymentStatus || order.status || 'Unknown',
    currency: order.currency?.toUpperCase() || 'EUR',
    
    // Delivery information (based on your database fields)
    marina: order.marina || order.boatLocation || 'Not specified',
    berthNumber: order.berthNumber || null,
    berthName: order.berthName || null,
    deliveryAddress: order.deliveryAddress || null,
    
    // Order items
    items: formattedItems,
    
    // Special instructions (based on your database fields)
    hasSpecialInstructions: hasSpecialInstructions,
    specialNotes: order.specialNotes || null,
    deliveryInstructions: order.deliveryInstructions || null,
    
    // Additional info
    sessionId: order.sessionId || null,
    contactMe: order.contactMe || false,
    contactRental: order.contactRental || false
  };
}

// ========================================
// REPLACE YOUR EXISTING notifyNewOrder FUNCTION WITH THIS:
// ========================================

// 🔥 UPDATED: New Order Email Notification using SendGrid Template
exports.notifyNewOrder = onDocumentCreated({
  document: 'orders/{orderId}',
  // Try removing region specification or use a different region
  // region: "us-central1", // Comment this out first
  secrets: ["SENDGRID_API_KEY"]
}, async (event) => {
  try {
    console.log('🔥 NEW ORDER FUNCTION TRIGGERED!');
    console.log('📦 Full event object:', JSON.stringify(event, null, 2));
    
    // For v2, the data structure is different
    const snapshot = event.data;
    if (!snapshot) {
      console.log("❌ No data associated with the event");
      return;
    }
    
    const order = snapshot.data();
    const orderId = event.params.orderId;
    
    console.log('📦 Order ID:', orderId);
    console.log('📊 Order data received:', JSON.stringify(order, null, 2));
    
    // Check if SendGrid API key exists
    const apiKey = process.env.SENDGRID_API_KEY;
    console.log('🔑 SendGrid API key exists:', !!apiKey);
    console.log('🔑 API key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');
    
    // Check admin email
    console.log('📧 Admin email:', ADMIN_EMAIL);
    
    if (!apiKey) {
      console.error('❌ SendGrid API key not found!');
      return { success: false, error: 'SendGrid API key missing' };
    }
    
    if (!ADMIN_EMAIL || ADMIN_EMAIL === 'your-admin-email@example.com') {
      console.error('❌ Admin email not configured!');
      return { success: false, error: 'Admin email not configured' };
    }
    
    // Format order data for SendGrid template
    console.log('🔄 Formatting order data...');
    const templateData = formatOrderNotificationData(order, orderId);
    
    console.log('📋 Template data prepared:', JSON.stringify(templateData, null, 2));
    
    // Send email using SendGrid template
    const emailData = {
      to: ADMIN_EMAIL,
      from: 'info@justenjoyibiza.com',
      templateId: SENDGRID_ORDER_NOTIFICATION_TEMPLATE_ID,
      dynamic_template_data: templateData
    };
    
    console.log('📤 Sending email with data:', JSON.stringify(emailData, null, 2));
    
    const result = await sendEmailDirectApi(emailData);
    
    console.log('✅ Email sent successfully!', result);
    console.log(`📧 Order notification email sent for order #${templateData.orderNumber}`);
    
    return { success: true, message: 'Email notification sent' };
    
  } catch (error) {
    console.error('❌ ERROR in notifyNewOrder function:', error);
    console.error('❌ Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

// ========================================
// ADD THIS NEW TEST FUNCTION:
// ========================================

// 🆕 Test function for order notification emails
exports.testOrderNotification = onCall({
  region: "us-central1",
  secrets: ["SENDGRID_API_KEY"],
  maxInstances: 10
}, async (request) => {
  try {
    console.log('Test function called');
    
    // Test order based on your actual database structure
    const testOrder = {
      orderId: 'TEST123',
      fullName: 'John Test Customer',
      boatName: 'Luna',
      customerEmail: 'customer@test.com',
      phoneNumber: '695688348',
      rentalCompany: 'Just Enjoy Ibiza',
      orderDate: '2025-05-27',
      marina: 'Marina Ibiza',
      boatLocation: 'Marina Ibiza',
      berthNumber: 'A20',
      berthName: 'Premium Berth',
      deliveryAddress: 'Marina Ibiza, Berth A20',
      amount_total: 25.50,
      currency: 'eur',
      orderSource: 'Website',
      paymentMethod: 'card',
      paymentStatus: 'paid',
      status: 'paid',
      specialNotes: 'Please deliver to the main dock',
      deliveryInstructions: 'Call when arriving at marina',
      contactMe: false,
      contactRental: false,
      sessionId: 'cs_test_123456789',
      items: [
        { 
          id: '506GkIox9zysB7bGXLXx',
          name: 'Solan de Cabras 0.33ml', 
          quantity: 2, 
          price: 1.00 
        },
        { 
          id: '507GkIox9zysB7bGXLXy',
          name: 'Paella Valenciana', 
          quantity: 1, 
          price: 23.50 
        }
      ]
    };
    
    console.log('Formatting test order data...');
    const templateData = formatOrderNotificationData(testOrder, 'test-order-id');
    
    console.log('Template data:', templateData);
    
    const emailData = {
      to: ADMIN_EMAIL,
      from: 'info@justenjoyibiza.com',
      templateId: SENDGRID_ORDER_NOTIFICATION_TEMPLATE_ID,
      dynamic_template_data: templateData
    };

    console.log('Sending email with SendGrid...');
    await sendEmailDirectApi(emailData);
    
    console.log('Test email sent successfully!');
    
    return { 
      success: true, 
      message: `Test order notification email sent to ${ADMIN_EMAIL}`,
      templateId: SENDGRID_ORDER_NOTIFICATION_TEMPLATE_ID
    };
  } catch (error) {
    console.error('Test function error:', error);
    throw new HttpsError('internal', `Test failed: ${error.message}`);
  }
});