import admin from 'firebase-admin';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

let firestoreInstance = null;

function getProvidedSecret(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerCandidates = [req.headers['x-api-key'], req.headers['x-sync-secret'], req.headers['x-provider-token']];
  for (const candidate of headerCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const bodyCandidates = [
    body.statusCallbackAuthToken,
    body.authToken,
    body.syncSecret,
    body.token,
    body.apiKey,
  ];
  for (const candidate of bodyCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function getExpectedSecrets() {
  return [
    process.env.PAYMENT_LINK_SYNC_SECRET,
    process.env.PAYMENT_LINK_PROVIDER_API_KEY,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
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
    console.error('Payment link deactivate: failed to initialize Firebase Admin', error);
    return null;
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, x-sync-secret, x-provider-token'
  );
}

async function deactivateStripePaymentLink(stripeLinkId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const response = await fetch(`${STRIPE_API_BASE}/payment_links/${stripeLinkId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ active: 'false' }).toString(),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

async function resolvePaymentLinkRecord(db, paymentLinkId) {
  let ref = db.collection('paymentLinks').doc(paymentLinkId);
  let docSnap = await ref.get();

  if (docSnap.exists) {
    return { ref, docSnap };
  }

  const fallbackSnapshot = await db
    .collection('paymentLinks')
    .where('stripeLinkId', '==', paymentLinkId)
    .limit(1)
    .get();

  if (fallbackSnapshot.empty) {
    return null;
  }

  docSnap = fallbackSnapshot.docs[0];
  ref = docSnap.ref;
  return { ref, docSnap };
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

  const expectedSecrets = getExpectedSecrets();
  if (!expectedSecrets.length) {
    res.status(500).json({ error: 'Payment link auth secret is not configured.' });
    return;
  }

  const providedSecret = getProvidedSecret(req);
  if (!providedSecret || !expectedSecrets.includes(providedSecret)) {
    res.status(401).json({ error: 'Invalid API key.' });
    return;
  }

  const paymentLinkId = typeof req.body?.paymentLinkId === 'string' ? req.body.paymentLinkId.trim() : '';
  if (!paymentLinkId) {
    res.status(400).json({ error: 'paymentLinkId is required' });
    return;
  }

  const db = getFirestore();
  if (!db) {
    res.status(500).json({ error: 'Firestore is not configured.' });
    return;
  }

  try {
    const resolved = await resolvePaymentLinkRecord(db, paymentLinkId);
    if (!resolved) {
      res.status(404).json({ error: 'Payment link not found' });
      return;
    }

    const { ref, docSnap } = resolved;
    const data = docSnap.data() || {};
    const stripeLinkId =
      paymentLinkId && paymentLinkId.startsWith('plink_') ? paymentLinkId : data.stripeLinkId;

    if (!stripeLinkId) {
      res.status(400).json({ error: 'Payment link is missing stripeLinkId' });
      return;
    }

    if (data.paymentStatus === 'paid') {
      res.status(400).json({ error: 'Paid payment links cannot be deactivated' });
      return;
    }

    await deactivateStripePaymentLink(stripeLinkId);

    await ref.set(
      {
        status: 'inactive',
        paymentStatus: data.paymentStatus || 'pending',
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deactivationReason: 'manual',
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      paymentLinkId: ref.id,
      stripeLinkId,
      status: 'cancelled',
      paymentStatus: data.paymentStatus || 'pending',
    });
  } catch (error) {
    console.error('Payment link deactivation error:', error);
    res.status(400).json({ error: error.message || 'Failed to deactivate payment link.' });
  }
}
