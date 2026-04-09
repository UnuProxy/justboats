import admin from 'firebase-admin';

const DEFAULT_SUCCESS_URL = process.env.SUCCESS_REDIRECT_URL || 'https://nautiqibiza.com/thanks';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const BOATOX_STATUS_CALLBACK_URL = 'https://boatox.vercel.app/api/payment-links/provider-status';

let firestoreInstance = null;

function getProvidedApiKey(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerApiKey = req.headers['x-api-key'];
  if (typeof headerApiKey === 'string') {
    return headerApiKey.trim();
  }

  return '';
}

function getFirestore() {
  if (firestoreInstance) return firestoreInstance;

  if (admin.apps.length) {
    firestoreInstance = admin.firestore();
    return firestoreInstance;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccount);
    admin.initializeApp({ credential: admin.credential.cert(credentials) });
    firestoreInstance = admin.firestore();
    return firestoreInstance;
  } catch (error) {
    console.error('Payment link provider: failed to initialize Firebase Admin', error);
    return null;
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-source-app');
}

function resolveCallbackConfig(sourceApp, statusCallbackUrl, statusCallbackAuthToken) {
  const normalizedSourceApp = String(sourceApp || '').trim().toLowerCase();
  const explicitUrl = typeof statusCallbackUrl === 'string' ? statusCallbackUrl.trim() : '';
  const explicitToken = typeof statusCallbackAuthToken === 'string' ? statusCallbackAuthToken.trim() : '';

  if (explicitUrl || explicitToken) {
    return {
      statusCallbackUrl: explicitUrl || null,
      statusCallbackAuthToken: explicitToken || null,
    };
  }

  const defaultToken = String(
    process.env.PAYMENT_LINK_SYNC_SECRET ||
    process.env.PAYMENT_LINK_PROVIDER_API_KEY ||
    ''
  ).trim();
  const shouldUseBoatoxDefaults =
    !normalizedSourceApp ||
    normalizedSourceApp === 'external-app' ||
    normalizedSourceApp === 'boatox-ibiza';

  if (!shouldUseBoatoxDefaults || !defaultToken) {
    return {
      statusCallbackUrl: null,
      statusCallbackAuthToken: null,
    };
  }

  return {
    statusCallbackUrl: BOATOX_STATUS_CALLBACK_URL,
    statusCallbackAuthToken: defaultToken,
  };
}

async function createStripePaymentLink({
  amount,
  currency = 'eur',
  description,
  customerName,
  customerEmail,
  bookingId,
  bookingReference,
  successUrl,
  notes,
  sourceApp,
  statusCallbackUrl,
  statusCallbackAuthToken,
  expireInHours,
  expiresAt,
}) {
  const numericAmount = Number(amount);
  if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('A valid amount is required.');
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const resolvedSourceApp = String(sourceApp || 'external-app').trim();
  const validatedExpireInHours = expireInHours === 24 || expireInHours === 48 ? expireInHours : null;
  if (expireInHours != null && validatedExpireInHours == null) {
    throw new Error('Expiration must be 24 or 48 hours.');
  }
  const requestedExpiresAt =
    typeof expiresAt === 'string' && expiresAt.trim() ? new Date(expiresAt.trim()) : null;
  const resolvedExpiresAt =
    validatedExpireInHours != null
      ? new Date(Date.now() + validatedExpireInHours * 60 * 60 * 1000)
      : requestedExpiresAt && !Number.isNaN(requestedExpiresAt.getTime())
        ? requestedExpiresAt
        : null;
  const callbackConfig = resolveCallbackConfig(
    resolvedSourceApp,
    statusCallbackUrl,
    statusCallbackAuthToken
  );
  const linkDescription = (description || `Payment for ${customerName || 'Boatox Ibiza client'}`).trim().slice(0, 180);
  const amountInCents = Math.round(numericAmount * 100);

  const formData = new URLSearchParams();
  formData.append('line_items[0][price_data][currency]', String(currency || 'eur').toLowerCase());
  formData.append('line_items[0][price_data][product_data][name]', linkDescription);
  formData.append('line_items[0][price_data][unit_amount]', String(amountInCents));
  formData.append('line_items[0][quantity]', '1');
  formData.append('customer_creation', 'always');
  formData.append('allow_promotion_codes', 'false');
  formData.append('after_completion[type]', 'redirect');
  formData.append('after_completion[redirect][url]', successUrl || DEFAULT_SUCCESS_URL);

  formData.append('metadata[source]', resolvedSourceApp);
  formData.append('metadata[provider]', 'payment-link-provider');

  if (bookingId) formData.append('metadata[bookingId]', String(bookingId));
  if (bookingReference) formData.append('metadata[bookingReference]', String(bookingReference));
  if (customerName) formData.append('metadata[customerName]', String(customerName));
  if (customerEmail) formData.append('metadata[customerEmail]', String(customerEmail));
  if (notes) formData.append('metadata[notes]', String(notes));

  const response = await fetch(`${STRIPE_API_BASE}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const link = await response.json().catch(() => null);
  if (!response.ok) {
    const message = link?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  const db = getFirestore();
  if (db) {
    try {
      await db.collection('paymentLinks').doc(link.id).set({
        amount: numericAmount,
        currency: String(currency || 'eur').toLowerCase(),
        description: linkDescription,
        bookingId: bookingId || null,
        bookingReference: bookingReference || null,
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        stripeLinkId: link.id,
        url: link.url,
        status: link.active ? 'active' : 'inactive',
        paymentStatus: 'pending',
        createdBy: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAt: null,
        notes: notes || null,
        expireInHours: validatedExpireInHours,
        expiresAt: resolvedExpiresAt ? admin.firestore.Timestamp.fromDate(resolvedExpiresAt) : null,
        sourceApp: resolvedSourceApp,
        statusCallbackUrl: callbackConfig.statusCallbackUrl,
        statusCallbackAuthToken: callbackConfig.statusCallbackAuthToken,
      });
    } catch (error) {
      console.error('Payment link provider: failed to persist payment link', error);
    }
  }

  return {
    success: true,
    id: link.id,
    url: link.url,
    amount: numericAmount,
    currency: String(currency || 'eur').toLowerCase(),
    expiresAt: resolvedExpiresAt ? resolvedExpiresAt.toISOString() : link.expires_at || null,
    sourceApp: resolvedSourceApp,
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const expectedApiKey = process.env.PAYMENT_LINK_PROVIDER_API_KEY;
  if (!expectedApiKey) {
    res.status(500).json({ error: 'PAYMENT_LINK_PROVIDER_API_KEY is not configured.' });
    return;
  }

  const providedApiKey = getProvidedApiKey(req);
  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    res.status(401).json({ error: 'Invalid API key.' });
    return;
  }

  try {
    const payload = req.body || {};
    const result = await createStripePaymentLink({
      ...payload,
      sourceApp: payload.sourceApp || req.headers['x-source-app'],
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Payment link provider error:', error);
    res.status(400).json({ error: error.message || 'Failed to create payment link.' });
  }
}
