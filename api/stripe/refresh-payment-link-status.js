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
    console.error('Payment link refresh: failed to initialize Firebase Admin', error);
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

async function fetchLatestStripePaymentStatusForLink(stripeLinkId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const params = new URLSearchParams();
  params.set('payment_link', stripeLinkId);
  params.set('limit', '100');

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  const sessions = Array.isArray(body?.data) ? body.data : [];
  if (!sessions.length) {
    return { paymentStatus: 'pending', session: null, sessionsFound: 0 };
  }

  const paidSession = sessions.find((session) => session?.payment_status === 'paid');
  const session = paidSession || sessions[0];
  const paymentStatus =
    session?.payment_status === 'paid'
      ? 'paid'
      : session?.payment_status === 'unpaid'
      ? 'pending'
      : session?.payment_status || 'pending';

  return { paymentStatus, session, sessionsFound: sessions.length };
}

async function deactivateStripePaymentLink(stripeLinkId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return;
  }

  const response = await fetch(`${STRIPE_API_BASE}/payment_links/${stripeLinkId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ active: 'false' }).toString(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    console.error(
      'Refresh failed to deactivate payment link',
      stripeLinkId,
      body?.error?.message || response.status
    );
  }
}

function resolveExpiresAtDate(paymentLinkData) {
  const rawValue = paymentLinkData?.expiresAt;
  if (!rawValue) return null;

  if (typeof rawValue?.toDate === 'function') {
    return rawValue.toDate();
  }

  if (rawValue instanceof Date) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

async function notifyPaymentLinkStatusCallback(paymentLinkData, stripeLinkId, paymentStatus, session) {
  if (
    paymentStatus !== 'paid' ||
    paymentLinkData?.paymentStatus === 'paid' ||
    !paymentLinkData?.statusCallbackUrl
  ) {
    return;
  }

  try {
    await fetch(paymentLinkData.statusCallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(paymentLinkData.statusCallbackAuthToken
          ? { Authorization: `Bearer ${paymentLinkData.statusCallbackAuthToken}` }
          : {}),
      },
      body: JSON.stringify({
        stripePaymentLinkId: stripeLinkId,
        status: 'completed',
        paidAt: session?.created
          ? new Date(session.created * 1000).toISOString()
          : new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to notify external payment link status callback', error);
  }
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

    const expiresAtDate = resolveExpiresAtDate(data);
    const isExpired =
      expiresAtDate != null &&
      !Number.isNaN(expiresAtDate.getTime()) &&
      expiresAtDate.getTime() <= Date.now() &&
      data.paymentStatus !== 'paid' &&
      data.deactivationReason !== 'manual' &&
      !data.expiredAt;

    if (isExpired) {
      await deactivateStripePaymentLink(stripeLinkId);
      await ref.set(
        {
          status: 'inactive',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (data.statusCallbackUrl) {
        try {
          await fetch(data.statusCallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(data.statusCallbackAuthToken
                ? { Authorization: `Bearer ${data.statusCallbackAuthToken}` }
                : {}),
            },
            body: JSON.stringify({
              stripePaymentLinkId: stripeLinkId,
              status: 'expired',
            }),
          });
        } catch (error) {
          console.error('Failed to notify external payment link expiry callback', error);
        }
      }

      res.status(200).json({
        success: true,
        paymentStatus: data.paymentStatus || 'pending',
        status: 'expired',
        stripeLinkId,
        expiresAt: expiresAtDate.toISOString(),
      });
      return;
    }

    const { paymentStatus, session, sessionsFound } = await fetchLatestStripePaymentStatusForLink(stripeLinkId);

    await ref.set(
      {
        stripeLastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeLastSessionsFound: sessionsFound,
        stripeLastCheckResult: session ? 'ok' : 'no_sessions',
      },
      { merge: true }
    );

    if (!session) {
      res.status(200).json({
        success: true,
        paymentStatus: 'pending',
        stripeLinkId,
        sessionsFound: 0,
      });
      return;
    }

    const update = {
      paymentStatus,
      status: paymentStatus === 'paid' ? 'inactive' : data.status || 'active',
      lastStripeSessionId: session?.id || null,
      lastStripePaymentIntent: session?.payment_intent || null,
      paidAt:
        paymentStatus === 'paid' && session?.created
          ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
          : admin.firestore.FieldValue.delete(),
    };

    await ref.set(update, { merge: true });
    await notifyPaymentLinkStatusCallback(data, stripeLinkId, paymentStatus, session);

    if (paymentStatus === 'paid') {
      await deactivateStripePaymentLink(stripeLinkId);
    }

    res.status(200).json({
      success: true,
      paymentStatus,
      stripeLinkId,
      sessionsFound,
      lastStripeSessionId: update.lastStripeSessionId,
      paidAt:
        paymentStatus === 'paid' && session?.created
          ? new Date(session.created * 1000).toISOString()
          : null,
    });
  } catch (error) {
    console.error('Payment link refresh error:', error);
    res.status(400).json({ error: error.message || 'Failed to refresh payment status.' });
  }
}
