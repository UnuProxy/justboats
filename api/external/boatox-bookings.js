function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const providerUrl = process.env.BOATOX_BOOKINGS_URL?.trim();
  const providerApiKey = process.env.BOATOX_BOOKINGS_API_KEY?.trim();
  if (!providerUrl) {
    res.status(500).json({ error: 'BOATOX_BOOKINGS_URL is not configured.' });
    return;
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(providerApiKey ? { Authorization: `Bearer ${providerApiKey}` } : {}),
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (body &&
          typeof body === 'object' &&
          (typeof body.error === 'string'
            ? body.error
            : typeof body.message === 'string'
            ? body.message
            : null)) ||
        `Boatox bookings provider failed (${response.status})`;

      res.status(response.status).json({ error: message });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(body);
  } catch (error) {
    console.error('Boatox bookings proxy failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch Boatox bookings.',
    });
  }
}
