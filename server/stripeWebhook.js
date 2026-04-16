const Stripe = require('stripe');
const admin = require('firebase-admin');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : null;

let firestore;

async function getRawBody(req) {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function getFirestore() {
  if (firestore) return firestore;

  if (admin.apps.length) {
    firestore = admin.firestore();
    return firestore;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.warn('Stripe webhook: FIREBASE_SERVICE_ACCOUNT_KEY not set; Firestore update skipped');
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccount);
    admin.initializeApp({ credential: admin.credential.cert(credentials) });
    firestore = admin.firestore();
    return firestore;
  } catch (err) {
    console.error('Stripe webhook: failed to init Firebase Admin', err);
    return null;
  }
}

function buildStripePaymentLinkUpdate(existing = {}, paymentStatus, stripeObject = {}) {
  const stripeObjectType = String(stripeObject?.object || '').trim();
  const stripeSessionId = stripeObjectType === 'checkout.session' && stripeObject?.id
    ? stripeObject.id
    : null;
  const stripePaymentIntentId = stripeObject?.payment_intent
    || (stripeObjectType === 'payment_intent' && stripeObject?.id ? stripeObject.id : null);

  const update = {
    paymentStatus,
    status: paymentStatus === 'paid' ? 'inactive' : existing.status || 'active',
  };

  if (stripeSessionId) {
    update.lastStripeSessionId = stripeSessionId;
  }

  if (stripePaymentIntentId) {
    update.lastStripePaymentIntent = stripePaymentIntentId;
  }

  if (paymentStatus === 'paid') {
    if (stripeObject?.created) {
      update.paidAt = admin.firestore.Timestamp.fromMillis(stripeObject.created * 1000);
    } else if (!existing.paidAt) {
      update.paidAt = admin.firestore.FieldValue.serverTimestamp();
    }
  } else {
    update.paidAt = admin.firestore.FieldValue.delete();
  }

  return update;
}

async function updatePaymentLinkStatus(stripeLinkId, paymentStatus, session = {}) {
  const db = getFirestore();
  if (!db) {
    return false;
  }

  try {
    let ref = db.collection('paymentLinks').doc(stripeLinkId);
    let snap = await ref.get();

    if (!snap.exists) {
      const fallback = await db
        .collection('paymentLinks')
        .where('stripeLinkId', '==', stripeLinkId)
        .limit(1)
        .get();

      if (fallback.empty) {
        console.warn('Stripe webhook: payment link not found', stripeLinkId);
        return false;
      }

      snap = fallback.docs[0];
      ref = snap.ref;
    }

    const existing = snap.data() || {};
    const update = buildStripePaymentLinkUpdate(existing, paymentStatus, session);

    await ref.set(update, { merge: true });

    if (paymentStatus === 'paid' && existing.paymentStatus !== 'paid' && existing.statusCallbackUrl) {
      try {
        const callbackResponse = await fetch(existing.statusCallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(existing.statusCallbackAuthToken
              ? { Authorization: `Bearer ${existing.statusCallbackAuthToken}` }
              : {}),
          },
          body: JSON.stringify({
            stripePaymentLinkId: stripeLinkId,
            status: 'completed',
            paidAt: session.created
              ? new Date(session.created * 1000).toISOString()
              : new Date().toISOString(),
          }),
        });

        if (!callbackResponse.ok) {
          const responseText = await callbackResponse.text().catch(() => '');
          throw new Error(`Callback failed (${callbackResponse.status}): ${responseText || callbackResponse.statusText}`);
        }
      } catch (callbackError) {
        console.error('Stripe webhook: failed to notify external callback', callbackError);
      }
    }

    if (paymentStatus === 'paid' && stripe) {
      try {
        await stripe.paymentLinks.update(stripeLinkId, { active: false });
      } catch (err) {
        console.error('Stripe webhook: failed to deactivate payment link', stripeLinkId, err);
      }
    }

    return true;
  } catch (err) {
    console.error('Stripe webhook: failed to update payment status', err);
    return false;
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
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
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook: signature verification failed', err);
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

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook: handler error', err);
    res.status(500).send('Webhook handler error');
  }
}

module.exports = {
  handler,
  config: {
    api: {
      bodyParser: false
    }
  }
};
