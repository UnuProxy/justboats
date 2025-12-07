const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const axios = require('axios');
const { getMessaging } = require('firebase-admin/messaging');
const Stripe = require('stripe');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const TEAM_ROLES = ['admin', 'staff'];

async function getUserRole(uid) {
  if (!uid) {
    return null;
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.exists ? userDoc.data().role : null;
  } catch (error) {
    console.error('Role lookup failed:', error);
    return null;
  }
}

function hasAllowedRole(role, allowedRoles = TEAM_ROLES) {
  return role != null && allowedRoles.includes(role);
}

async function assertCallableAuthorization(request, allowedRoles = TEAM_ROLES) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const role = await getUserRole(request.auth.uid);
  if (!hasAllowedRole(role, allowedRoles)) {
    throw new HttpsError('permission-denied', 'Insufficient permissions');
  }

  return { uid: request.auth.uid, role };
}

async function authenticateHttpRequest(req, res, allowedRoles = TEAM_ROLES) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return null;
  }

  const idToken = authHeader.substring(7);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const role = await getUserRole(decoded.uid);

    if (!hasAllowedRole(role, allowedRoles)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return null;
    }

    return { uid: decoded.uid, role };
  } catch (error) {
    console.error('ID token verification failed:', error);
    res.status(401).json({ error: 'Invalid authentication token' });
    return null;
  }
}

// Constants
const SENDGRID_ORDER_NOTIFICATION_TEMPLATE_ID = 'd-19b8a21dc04c4c8aa3171f6faf5de453';
// Allow template IDs to be driven by secrets/env; fall back to known defaults
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID || 'd-a0536d03f0c74ef2b52e722e8b26ef4e';
const SENDGRID_MULTI_BOAT_TEMPLATE_ID = process.env.SENDGRID_MULTI_BOAT_TEMPLATE_ID || 'd-a0536d03f0c74ef2b52e722e8b26ef4e';
const ALLOWED_ORIGINS = [
  'https://justboats.vercel.app',
  'https://justenjoyibizaboats.com',
  'http://localhost:3000',
  'http://localhost:3001'
];
const ADMIN_EMAIL = 'unujulian@gmail.com';
const SENDGRID_PAYMENT_REMINDER_TEMPLATE_ID = process.env.SENDGRID_PAYMENT_REMINDER_TEMPLATE_ID || null;
const PAYMENT_REMINDER_WINDOW_DAYS = 5;
const PAYMENT_REMINDER_LOOKAHEAD_DAYS = 14;
const PAYMENT_REMINDER_MIN_HOURS_BETWEEN_EMAILS = 22;
const OUTSTANDING_PAYMENT_STATUSES = ['No Payment', 'Partial', 'Pending', 'Deposit', 'Outstanding'];
const BRAND_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'info@nautiqibiza.com';
const CATERING_MENU_URL = 'https://nautiqibiza.com/catering';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' }) : null;
const DEFAULT_SUCCESS_URL = process.env.SUCCESS_REDIRECT_URL || 'https://nautiqibiza.com/thanks';
// Simplified API key handling using Firebase Secrets
function getApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key not configured in environment variables');
  }
  return apiKey;
}

function handleCors(req, res) {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin);

  if (isAllowedOrigin && origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }

  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  if (!isAllowedOrigin && origin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }

  return false;
}

function mapHttpsErrorToStatus(error) {
  if (error instanceof HttpsError) {
    const statusMap = {
      'invalid-argument': 400,
      'failed-precondition': 400,
      'permission-denied': 403,
      'unauthenticated': 401,
      'not-found': 404,
      'resource-exhausted': 429,
      'unavailable': 503,
      'deadline-exceeded': 504
    };
    return statusMap[error.code] || 500;
  }
  return 500;
}

async function updatePaymentLinkStatus(stripeLinkId, paymentStatus, session = {}) {
  if (!stripeLinkId) return;

  try {
    // Primary lookup by document ID (now matches Stripe link ID)
    let ref = db.collection('paymentLinks').doc(stripeLinkId);
    let docSnap = await ref.get();

    // Fallback: older records created before ID alignment
    if (!docSnap.exists) {
      const snapshot = await db
        .collection('paymentLinks')
        .where('stripeLinkId', '==', stripeLinkId)
        .limit(1)
        .get();
      if (snapshot.empty) {
        console.warn('Payment link not found for Stripe ID', stripeLinkId);
        return;
      }
      docSnap = snapshot.docs[0];
      ref = docSnap.ref;
    }

    const existing = docSnap.data() || {};

    if (existing.paymentStatus === 'paid' && paymentStatus === 'paid') {
      return;
    }

    const updateData = {
      paymentStatus,
      lastStripeSessionId: session.id || null,
      lastStripePaymentIntent: session.payment_intent || null,
      paidAt: paymentStatus === 'paid' && session.created
        ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
        : admin.firestore.FieldValue.delete()
    };

    await ref.set(updateData, { merge: true });

    if (paymentStatus === 'paid' && stripe) {
      try {
        await stripe.paymentLinks.update(stripeLinkId, { active: false });
      } catch (err) {
        console.error('Failed to deactivate payment link after payment', err);
      }
    }
  } catch (error) {
    console.error('Failed to update payment link status', error);
  }
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
    console.error('SendGrid Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`SendGrid API Error: ${error.response?.status || ''} ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

async function sendPlainEmail(to, subject, text) {
  const apiKey = getApiKey();
  await axios({
    method: 'post',
    url: 'https://api.sendgrid.com/v3/mail/send',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    data: {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: BRAND_FROM_EMAIL },
      subject,
      content: [{
        type: 'text/plain',
        value: text
      }]
    }
  });

  return { success: true };
}

async function createStripePaymentLinkInternal(data, authContext) {
  const {
    amount,
    currency = 'eur',
    description,
    customerName,
    customerEmail,
    bookingId,
    successUrl,
    notes
  } = data || {};

  const numericAmount = Number(amount);
  if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new HttpsError('invalid-argument', 'A valid amount is required to create a payment link.');
  }
  const amountInCents = Math.round(numericAmount * 100);

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new HttpsError('failed-precondition', 'Stripe secret key is not configured.');
  }

  const linkDescription = (description || `Payment for ${customerName || 'Nautiq Ibiza client'}`).trim().slice(0, 180);
  const formData = new URLSearchParams();
  formData.append('line_items[0][price_data][currency]', currency.toLowerCase());
  formData.append('line_items[0][price_data][product_data][name]', linkDescription);
  formData.append('line_items[0][price_data][unit_amount]', amountInCents.toString());
  formData.append('line_items[0][quantity]', '1');
  formData.append('customer_creation', 'always');
  formData.append('allow_promotion_codes', 'false');

  if (authContext?.uid) {
    formData.append('metadata[createdBy]', authContext.uid);
  }
  formData.append('metadata[source]', 'nautiq-app');

  if (bookingId) formData.append('metadata[bookingId]', String(bookingId));
  if (customerName) formData.append('metadata[customerName]', customerName);
  if (customerEmail) formData.append('metadata[customerEmail]', customerEmail);
  if (notes) formData.append('metadata[notes]', notes);
  formData.append('after_completion[type]', 'redirect');
  formData.append('after_completion[redirect][url]', successUrl || DEFAULT_SUCCESS_URL);

  const response = await axios.post(
    'https://api.stripe.com/v1/payment_links',
    formData.toString(),
    {
      headers: {
        'Authorization': `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const link = response.data;

  // Use Stripe link ID as Firestore doc ID for direct lookup from webhook events
  const linkRef = db.collection('paymentLinks').doc(link.id);

  await linkRef.set({
    amount: numericAmount,
    currency: currency.toLowerCase(),
    description: linkDescription,
    bookingId: bookingId || null,
    customerName: customerName || null,
    customerEmail: customerEmail || null,
    stripeLinkId: link.id,
    url: link.url,
    status: link.active ? 'active' : 'inactive',
    paymentStatus: 'pending',
    createdBy: authContext?.uid || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: null,
    notes: notes || null
  });

  // Backfill metadata onto the Stripe link for webhook correlation
  if (stripe) {
    try {
      await stripe.paymentLinks.update(link.id, {
        metadata: {
          firestoreId: link.id,
          bookingId: bookingId || '',
          customerEmail: customerEmail || '',
          customerName: customerName || ''
        }
      });
    } catch (err) {
      console.error('Failed to attach metadata to Stripe link', err);
    }
  }

  return {
    success: true,
    url: link.url,
    id: link.id,
    amount: numericAmount,
    currency: currency.toLowerCase(),
    expiresAt: link.expires_at || null
  };
}

// Create a Stripe Payment Link (admin + staff only) - callable
exports.createStripePaymentLink = onCall({
  region: "us-central1",
  cors: ALLOWED_ORIGINS,
  secrets: ["STRIPE_SECRET_KEY"],
  maxInstances: 10
}, async (request) => {
  try {
    const authContext = await assertCallableAuthorization(request, ['admin', 'staff']);
    return await createStripePaymentLinkInternal(request.data || {}, authContext);
  } catch (error) {
    console.error('createStripePaymentLink error:', error.response?.data || error);
    if (error instanceof HttpsError) {
      throw error;
    }
    const message = error.response?.data?.error?.message || error.message || 'Failed to create payment link';
    throw new HttpsError('internal', message);
  }
});

// HTTP version for non-Firebase clients (handles CORS preflight)
exports.createStripePaymentLinkHttp = onRequest({
  region: "us-central1",
  cors: false,
  secrets: ["STRIPE_SECRET_KEY"],
  maxInstances: 10
}, async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const authContext = await authenticateHttpRequest(req, res, ['admin', 'staff']);
  if (!authContext) {
    return;
  }

  try {
    const result = await createStripePaymentLinkInternal(req.body || {}, authContext);
    res.status(200).json(result);
  } catch (error) {
    console.error('createStripePaymentLinkHttp error:', error.response?.data || error);
    const status = mapHttpsErrorToStatus(error);
    const message = error.response?.data?.error?.message || error.message || 'Failed to create payment link';
    res.status(status).json({ error: message });
  }
});

// Stripe webhook to update payment link payment status
exports.stripeWebhook = onRequest({
  region: "us-central1",
  cors: false,
  maxInstances: 10,
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!stripe || !stripeWebhookSecret) {
    res.status(500).send('Stripe not configured');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).send('Missing Stripe signature');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_link) {
          await updatePaymentLinkStatus(session.payment_link, 'paid', session);
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        if (session.payment_link) {
          await updatePaymentLinkStatus(session.payment_link, 'failed', session);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const linkId = intent.payment_link || intent.metadata?.firestoreId || intent.metadata?.payment_link;
        if (linkId) {
          await updatePaymentLinkStatus(linkId, 'paid', intent);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const linkId = intent.payment_link || intent.metadata?.firestoreId || intent.metadata?.payment_link;
        if (linkId) {
          await updatePaymentLinkStatus(linkId, 'failed', intent);
        }
        break;
      }
      default:
        break;
    }

    res.status(200).send({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler failed:', error);
    res.status(500).send('Webhook handler error');
  }
});

// Scheduled reconciliation to backfill payment statuses and enforce single-use even if webhooks are missed
exports.reconcilePaymentLinks = onSchedule({
  region: "us-central1",
  schedule: "every 15 minutes",
  timeZone: "Etc/UTC",
  maxInstances: 1,
  secrets: ["STRIPE_SECRET_KEY"]
}, async () => {
  if (!stripe) {
    console.warn('Stripe not configured; skipping reconciliation');
    return;
  }

  // Check the most recent pending/failed links to keep load low
  const snapshot = await db
    .collection('paymentLinks')
    .where('paymentStatus', 'in', ['pending', 'failed'])
    .limit(30)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const stripeLinkId = (doc.id && doc.id.startsWith('plink_')) ? doc.id : data.stripeLinkId;
    if (!stripeLinkId) continue;

    try {
      // Grab the latest Checkout Session for this payment link
      const { data: sessions } = await stripe.checkout.sessions.list({
        payment_link: stripeLinkId,
        limit: 1
      });

      if (!sessions || sessions.length === 0) continue;
      const session = sessions[0];
      const paymentStatus = session.payment_status === 'paid' ? 'paid'
        : session.payment_status === 'unpaid' ? 'pending'
        : session.payment_status;

      const update = {
        paymentStatus,
        lastStripeSessionId: session.id,
        lastStripePaymentIntent: session.payment_intent || null,
        paidAt: paymentStatus === 'paid'
          ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
          : admin.firestore.FieldValue.delete()
      };

      await doc.ref.set(update, { merge: true });

      // If paid, deactivate the link to enforce single-use
      if (paymentStatus === 'paid') {
        try {
          await stripe.paymentLinks.update(stripeLinkId, { active: false });
        } catch (err) {
          console.error('Reconcile failed to deactivate payment link', stripeLinkId, err);
        }
      }
    } catch (err) {
      console.error('Reconcile check failed for', stripeLinkId, err?.message || err);
    }
  }
});

async function sendSmsNotification(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('SMS skipped: Twilio not configured');
    return { success: false, skipped: true, reason: 'twilio_not_configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const payload = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body
  }).toString();

  await axios.post(url, payload, {
    auth: {
      username: accountSid,
      password: authToken
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return { success: true };
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

function formatDisplayDate(value) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatCurrency(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return `€${value}`;
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function buildBookingEmailContent(dynamicData) {
  const clientName = dynamicData.clientName || 'there';
  const bookingDateDisplay = formatDisplayDate(dynamicData.bookingDate);
  const timeRange = [dynamicData.startTime, dynamicData.endTime].filter(Boolean).join(' - ') || 'TBC';
  const guestsLabel = dynamicData.isMultiBoat
    ? `${dynamicData.totalPassengers || dynamicData.passengers || 'TBC'} guests`
    : `${dynamicData.passengers || 'TBC'} guests`;

  const introHtml = `
    <h2 style="margin: 0 0 16px; font-weight: 600; font-size: 20px; color: #0f172a;">
      Hi ${clientName},
    </h2>
    <p style="margin: 0 0 16px; color: #334155; font-size: 15px;">
      Thanks for booking with Nautiq Ibiza. Your charter is confirmed – here are the details you need to share with your guests and crew.
    </p>
  `;

  const cateringHtml = `
    <p style="margin: 24px 0 12px; color: #334155; font-size: 15px;">
      Start planning your onboard experience with our curated catering options:
    </p>
    <a href="${CATERING_MENU_URL}" target="_blank" rel="noopener"
       style="display: inline-block; padding: 12px 18px; background-color: #0284c7; color: #ffffff; border-radius: 6px; text-decoration: none; font-weight: 600;">
      View Catering Menu
    </a>
  `;

  const footerHtml = `
    <p style="margin: 24px 0 4px; color: #475569; font-size: 14px;">
      Need to adjust anything? Reply to this email or call +34 123 456 789 and we&rsquo;ll be happy to help.
    </p>
    <p style="margin: 0; color: #94a3b8; font-size: 13px;">
      See you on the dock,<br/>The Nautiq Ibiza team
    </p>
  `;

  if (dynamicData.isMultiBoat) {
    const boatsHtml = (dynamicData.boats || []).map((boat) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${boat.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #334155;">${boat.passengers || 'TBC'} guests</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatCurrency(boat.price || 0)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; padding: 32px;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);">
          ${introHtml}
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 17px; color: #0f172a;">Charter overview</h3>
            <p style="margin: 0 0 4px; color: #334155;">Date: <strong>${bookingDateDisplay}</strong></p>
            <p style="margin: 0 0 4px; color: #334155;">Time: <strong>${timeRange}</strong></p>
            <p style="margin: 0 0 4px; color: #334155;">Guests: <strong>${guestsLabel}</strong></p>
            <p style="margin: 0 0 4px; color: #334155;">Total investment: <strong>${formatCurrency(dynamicData.totalAmount)}</strong></p>
          </div>
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 17px; color: #0f172a;">Boats in this charter</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background-color: #e0f2fe; text-align: left;">
                  <th style="padding: 10px 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0369a1;">Boat</th>
                  <th style="padding: 10px 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0369a1;">Guests</th>
                  <th style="padding: 10px 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0369a1;">Agreed Price</th>
                </tr>
              </thead>
              <tbody>
                ${boatsHtml}
              </tbody>
            </table>
          </div>
          ${cateringHtml}
          ${footerHtml}
        </div>
      </div>
    `;

    const boatsText = (dynamicData.boats || []).map((boat, index) =>
      `${index + 1}. ${boat.name} – ${boat.passengers || 'TBC'} guests – ${formatCurrency(boat.price || 0)}`
    ).join('\n');

    const text = [
      `Hi ${clientName},`,
      ``,
      `Thanks for booking with Nautiq Ibiza. Your multi-boat charter is confirmed.`,
      ``,
      `Date: ${bookingDateDisplay}`,
      `Time: ${timeRange}`,
      `Guests: ${guestsLabel}`,
      `Total investment: ${formatCurrency(dynamicData.totalAmount)}`,
      ``,
      `Boats:`,
      boatsText,
      ``,
      `Catering menu: ${CATERING_MENU_URL}`,
      ``,
      `See you on the dock,`,
      `The Nautiq Ibiza team`
    ].join('\n');

    const subject = `Your multi-boat charter confirmation | ${bookingDateDisplay}`;

    return { subject, html, text };
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; padding: 32px;">
      <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);">
        ${introHtml}
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px; font-size: 17px; color: #0f172a;">Charter overview</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Boat</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${dynamicData.boatName || 'TBC'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Date</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${bookingDateDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Time</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${timeRange}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Guests</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${guestsLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Agreed price</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formatCurrency(dynamicData.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${cateringHtml}
        ${footerHtml}
      </div>
    </div>
  `;

  const text = [
    `Hi ${clientName},`,
    ``,
    `Thanks for booking with Nautiq Ibiza. Your charter is confirmed.`,
    ``,
    `Boat: ${dynamicData.boatName || 'TBC'}`,
    `Date: ${bookingDateDisplay}`,
    `Time: ${timeRange}`,
    `Guests: ${guestsLabel}`,
    `Agreed price: ${formatCurrency(dynamicData.totalAmount)}`,
    ``,
    `Catering menu: ${CATERING_MENU_URL}`,
    ``,
    `See you on the dock,`,
    `The Nautiq Ibiza team`
  ].join('\n');

  const subject = `${dynamicData.boatName || 'Your charter'} confirmed for ${bookingDateDisplay}`;

  return { subject, html, text };
}

async function sendBookingConfirmationEmailFallbackSendgrid(toEmail, dynamicData) {
  const templateId = dynamicData.isMultiBoat
    ? SENDGRID_MULTI_BOAT_TEMPLATE_ID
    : SENDGRID_TEMPLATE_ID;

  if (!templateId) {
    throw new Error('SendGrid template not configured for booking confirmation fallback');
  }

  await sendEmailDirectApi({
    to: toEmail,
    from: BRAND_FROM_EMAIL,
    templateId,
    dynamic_template_data: dynamicData
  });

  return { success: true, provider: 'sendgrid' };
}

async function sendBookingConfirmationEmail(toEmail, dynamicData) {
  const fallbackResult = await sendBookingConfirmationEmailFallbackSendgrid(toEmail, dynamicData);
  return { ...fallbackResult, provider: 'sendgrid' };
}

function formatReminderMessage(reminder) {
  const dueDate = reminder?.dueDate instanceof Date
    ? reminder.dueDate
    : reminder?.dueDate?.toDate
      ? reminder.dueDate.toDate()
      : null;

  const dueLabel = dueDate
    ? dueDate.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No due date set';

  const lines = [
    `Reminder: ${reminder?.title || 'Untitled'}`,
    `When: ${dueLabel}`,
    reminder?.type ? `Type: ${reminder.type}` : null,
    reminder?.people ? `People: ${reminder.people}` : null,
    reminder?.relationship ? `Relationship: ${reminder.relationship}` : null,
    reminder?.location ? `Location / link: ${reminder.location}` : null,
    reminder?.relatedClient ? `Client: ${reminder.relatedClient}` : null,
    reminder?.relatedBoat ? `Boat: ${reminder.relatedBoat}` : null,
    reminder?.notes ? '' : null,
    reminder?.notes || null,
    '',
    '— Nautiq reminders'
  ].filter(Boolean);

  return lines.join('\n');
}

// Callable Function - Updated for multi-boat support
exports.sendBookingConfirmation = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  secrets: ["SENDGRID_API_KEY"],
  maxInstances: 10
}, async (request) => {
  try {
    await assertCallableAuthorization(request);
    const data = request.data;

    if (!data?.clientName || !data?.clientEmail) {
      throw new HttpsError('invalid-argument', 'Missing client details');
    }

    const emailContent = formatMultiBoatEmailData(data);
    const result = await sendBookingConfirmationEmail(data.clientEmail, emailContent);

    if (emailContent.isMultiBoat) {
      console.log(`Multi-boat confirmation sent via ${result.provider} to ${data.clientEmail} for ${emailContent.boatCount} boats`);
    } else {
      console.log(`Single boat confirmation sent via ${result.provider} to ${data.clientEmail} for ${emailContent.boatName}`);
    }

    return { success: true };
  } catch (error) {
    console.error('sendBookingConfirmation error:', error);
    throw new HttpsError('internal', error.message || 'Failed to send booking confirmation');
  }
});

// HTTP Endpoint - Updated for multi-boat support
exports.sendBookingConfirmationHttp = onRequest({
  region: "us-central1",
  cors: false,
  secrets: ["SENDGRID_API_KEY"]
}, async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const authContext = await authenticateHttpRequest(req, res);
    if (!authContext) {
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
    
    const dynamic_template_data = formatMultiBoatEmailData(data);
    const result = await sendBookingConfirmationEmail(data.clientEmail, dynamic_template_data);
    res.status(200).send({ success: true, provider: result.provider, multiBoat: isMultiBoat });
  } catch (error) {
    console.error('sendBookingConfirmationHttp error:', error);
    res.status(500).send({ error: error.message || 'Failed to send booking confirmation' });
  }
});

// Scheduled Function - Payment reminders
exports.paymentReminderSweep = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'Europe/Madrid',
  secrets: ['SENDGRID_API_KEY'],
  maxInstances: 1
}, async () => {
  console.log('Starting payment reminder sweep');
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  try {
    const snapshot = await db.collection('bookings')
      .where('pricing.paymentStatus', 'in', OUTSTANDING_PAYMENT_STATUSES)
      .get();

    if (snapshot.empty) {
      console.log('No outstanding bookings found for reminders');
      return null;
    }

    let processed = 0;
    let remindersQueued = 0;

    for (const docSnap of snapshot.docs) {
      processed += 1;
      const booking = docSnap.data();
      const bookingId = docSnap.id;

      const clientEmail = booking?.clientDetails?.email;
      if (!clientEmail) {
        console.log(`Skipping ${bookingId}: missing client email`);
        continue;
      }

      const bookingDate = booking?.bookingDetails?.date
        ? new Date(booking.bookingDetails.date)
        : booking?.bookingDate
          ? new Date(booking.bookingDate)
          : null;

      let daysUntil = null;
      if (bookingDate && !Number.isNaN(bookingDate.getTime())) {
        const bookingMidnight = new Date(bookingDate);
        bookingMidnight.setHours(0, 0, 0, 0);
        const diffMs = bookingMidnight.getTime() - midnight.getTime();
        daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000));
      }

      if (daysUntil !== null) {
        if (daysUntil > PAYMENT_REMINDER_LOOKAHEAD_DAYS) {
          continue;
        }
        if (daysUntil < -1) {
          continue;
        }
        if (daysUntil > PAYMENT_REMINDER_WINDOW_DAYS) {
          continue;
        }
      }

      const agreedPrice = Number(booking?.pricing?.agreedPrice || 0);
      const totalPaid = Number(booking?.pricing?.totalPaid || 0);
      const balanceDue = Math.max(agreedPrice - totalPaid, 0);

      if (balanceDue <= 0) {
        console.log(`Skipping ${bookingId}: balance already cleared`);
        continue;
      }

      const automation = booking?.automation || {};
      let lastReminderDate = null;
      if (automation.lastReminderSentAt) {
        if (typeof automation.lastReminderSentAt.toDate === 'function') {
          lastReminderDate = automation.lastReminderSentAt.toDate();
        } else {
          const parsed = new Date(automation.lastReminderSentAt);
          if (!Number.isNaN(parsed.getTime())) {
            lastReminderDate = parsed;
          }
        }
      }

      if (lastReminderDate) {
        const hoursSinceLastReminder = (now.getTime() - lastReminderDate.getTime()) / (60 * 60 * 1000);
        if (hoursSinceLastReminder < PAYMENT_REMINDER_MIN_HOURS_BETWEEN_EMAILS) {
          console.log(`Skipping ${bookingId}: reminder sent ${hoursSinceLastReminder.toFixed(1)} hours ago`);
          continue;
        }
      }

      const clientName = booking?.clientDetails?.name || 'Guest';
      const boatName = booking?.bookingDetails?.boatName || 'Charter';
      const paymentStatus = booking?.pricing?.paymentStatus || 'Pending';
      const paymentLink = `https://justboats.vercel.app/bookings/${bookingId}`;

      let reminderStatus = 'queued';

      if (SENDGRID_PAYMENT_REMINDER_TEMPLATE_ID) {
        try {
          const dynamicData = {
            clientName,
            boatName,
            bookingDate: bookingDate && !Number.isNaN(bookingDate.getTime())
              ? bookingDate.toISOString().split('T')[0]
              : 'TBC',
            balanceDue: balanceDue.toFixed(2),
            paymentStatus,
            daysUntil,
            paymentLink,
            bookingId
          };

          await sendEmailDirectApi({
            to: clientEmail,
            from: BRAND_FROM_EMAIL,
            templateId: SENDGRID_PAYMENT_REMINDER_TEMPLATE_ID,
            dynamic_template_data: dynamicData
          });

          reminderStatus = 'sent';
          remindersQueued += 1;
          console.log(`Reminder sent for booking ${bookingId} to ${clientEmail}`);
        } catch (sendError) {
          console.error(`Failed to send payment reminder for ${bookingId}:`, sendError);
          reminderStatus = 'send_error';
        }
      } else {
        console.log(`Payment reminder template not configured. Logging reminder for booking ${bookingId} only.`);
        reminderStatus = 'template_missing';
      }

      try {
        await docSnap.ref.set({
          automation: {
            ...automation,
            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReminderStatus: reminderStatus,
            lastReminderContext: {
              balanceDue,
              daysUntil,
              paymentStatus
            }
          }
        }, { merge: true });
      } catch (updateError) {
        console.error(`Failed to update automation metadata for ${bookingId}:`, updateError);
      }

      try {
        await db.collection('reminders').add({
          bookingId,
          clientEmail,
          clientName,
          boatName,
          status: reminderStatus,
          balanceDue,
          bookingDate: bookingDate && !Number.isNaN(bookingDate?.getTime())
            ? admin.firestore.Timestamp.fromDate(bookingDate)
            : null,
          daysUntil,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentStatus
        });
      } catch (logError) {
        console.error(`Failed to log reminder for ${bookingId}:`, logError);
      }
    }

    console.log(`Payment reminder sweep processed ${processed} bookings. ${remindersQueued} reminders sent or queued.`);
    return null;
  } catch (error) {
    console.error('Payment reminder sweep failed:', error);
    throw error;
  }
});

const REMINDER_SWEEP_WINDOW_MINUTES = 90;

exports.reminderNotificationSweep = onSchedule({
  schedule: '*/30 * * * *',
  timeZone: 'Europe/Madrid',
  secrets: ['SENDGRID_API_KEY'],
  maxInstances: 1
}, async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_SWEEP_WINDOW_MINUTES * 60 * 1000);
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    const snapshot = await db.collection('reminders')
      .where('source', '==', 'reminders_board')
      .where('shouldNotify', '==', true)
      .where('nextNotificationAt', '<=', admin.firestore.Timestamp.fromDate(windowEnd))
      .get();

    if (snapshot.empty) {
      console.log('No reminders ready for notifications');
      return null;
    }

    let processed = 0;
    for (const docSnap of snapshot.docs) {
      const reminder = docSnap.data();
      const reminderId = docSnap.id;
      const prefs = reminder.notificationPreferences || {};
      const dueDate = reminder?.dueDate?.toDate ? reminder.dueDate.toDate() : null;
      const minutesBefore = Number(reminder?.notifyMinutesBefore || prefs.minutesBefore || 120);
      let nextAt = reminder?.nextNotificationAt?.toDate ? reminder.nextNotificationAt.toDate() : null;

      if (!nextAt && dueDate && !Number.isNaN(minutesBefore)) {
        nextAt = new Date(dueDate.getTime() - minutesBefore * 60 * 1000);
      }

      if (!prefs.email && !prefs.sms) {
        continue;
      }
      if (nextAt && nextAt > windowEnd) {
        continue;
      }
      if (nextAt && nextAt < windowStart) {
        // Safety valve to avoid hammering legacy items stuck in the past
        console.log(`Skipping ${reminderId}: notification window elapsed`);
        continue;
      }

      const message = formatReminderMessage(reminder);
      const status = {
        lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (prefs.email && prefs.notificationEmail) {
        try {
          await sendPlainEmail(
            prefs.notificationEmail,
            `Reminder: ${reminder.title || 'Nautiq reminder'}`,
            message
          );
          status.email = {
            sent: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            to: prefs.notificationEmail
          };
        } catch (error) {
          console.error(`Email send failed for reminder ${reminderId}:`, error);
          status.email = { sent: false, error: error.message || 'Email send failed' };
        }
      }

      if (prefs.sms && prefs.notificationPhone) {
        try {
          const smsResult = await sendSmsNotification(prefs.notificationPhone, message.slice(0, 900));
          status.sms = {
            sent: !!smsResult.success && !smsResult.skipped,
            skipped: smsResult.skipped || false,
            reason: smsResult.reason || null,
            to: prefs.notificationPhone,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          };
        } catch (error) {
          console.error(`SMS send failed for reminder ${reminderId}:`, error);
          status.sms = { sent: false, error: error.message || 'SMS send failed' };
        }
      }

      await docSnap.ref.set({
        notificationStatus: status,
        nextNotificationAt: null
      }, { merge: true });
      processed += 1;
    }

    console.log(`Reminder notification sweep sent/queued ${processed} reminders`);
    return null;
  } catch (error) {
    console.error('Reminder notification sweep failed:', error);
    throw error;
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
      const emailPayload = {
        clientName: booking.clientDetails.name || 'Guest',
        clientEmail: booking.clientDetails.email,
        multiBoat: true,
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
      };

      const dynamicData = formatMultiBoatEmailData(emailPayload);
      const result = await sendBookingConfirmationEmail(emailPayload.clientEmail, dynamicData);
      
      // Mark this group as processed
      await emailSentRef.doc(groupId).set({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        clientEmail: booking.clientDetails.email,
        boatCount: boatBookings.length,
        provider: result.provider
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
      const emailPayload = {
        clientName: booking.clientDetails?.name || 'Guest',
        clientEmail: booking.clientDetails?.email,
        bookingDetails: {
          boatName: booking.bookingDetails?.boatName,
          date: booking.bookingDetails?.date,
          startTime: booking.bookingDetails?.startTime,
          endTime: booking.bookingDetails?.endTime,
          passengers: booking.bookingDetails?.passengers,
          price: booking.pricing?.finalPrice || booking.pricing?.agreedPrice || 0,
        }
      };

      const dynamicData = formatMultiBoatEmailData(emailPayload);
      await sendBookingConfirmationEmail(emailPayload.clientEmail, dynamicData);
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
    await assertCallableAuthorization(request, ['admin']);
    const testEmail = request.data?.testEmail || "test@example.com";
    const testMultiBoat = request.data?.testMultiBoat || false;
    
    if (!testMultiBoat) {
      // Test single boat email
      await sendEmailDirectApi({
        to: testEmail,
        from: BRAND_FROM_EMAIL,
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
        from: BRAND_FROM_EMAIL,
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
  cors: false,
  maxInstances: 10
}, async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

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
    let redirectUrl = `https://www.nautiqibiza.com/yacht-rental.html?promo=${promoCode}`;
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
        <title>Redirecting to Nautiq Ibiza</title>
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
    res.redirect(302, 'https://www.nautiqibiza.com/yacht-rental.html');
  }
});

// Function to track when users interact with the yacht rental page
exports.recordPlaceConversion = onCall({
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  maxInstances: 10
}, async (request) => {
  try {
    await assertCallableAuthorization(request);
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
      encodeURIComponent(`Hello, I'm interested in chartering with Nautiq Ibiza!`);
    
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
      from: BRAND_FROM_EMAIL,
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
    await assertCallableAuthorization(request, ['admin']);
    console.log('Test function called');
    
    // Test order based on your actual database structure
    const testOrder = {
      orderId: 'TEST123',
      fullName: 'John Test Customer',
      boatName: 'Luna',
      customerEmail: 'customer@test.com',
      phoneNumber: '695688348',
      rentalCompany: 'Nautiq Ibiza',
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
      from: BRAND_FROM_EMAIL,
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
