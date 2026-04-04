function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getRequestedUrl(query) {
  if (typeof query?.url === 'string') return query.url;
  if (Array.isArray(query?.url)) return query.url[0] || '';
  return '';
}

function isAllowedImageHost(url) {
  return url.hostname === 'firebasestorage.googleapis.com' || url.hostname === 'storage.googleapis.com';
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const rawUrl = getRequestedUrl(req.query);
  if (!rawUrl) {
    res.status(400).json({ error: 'Missing url query parameter.' });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch (error) {
    res.status(400).json({ error: 'Invalid image URL.' });
    return;
  }

  if (!isAllowedImageHost(targetUrl)) {
    res.status(400).json({ error: 'Image host is not allowed.' });
    return;
  }

  try {
    const response = await fetch(targetUrl.toString());
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch image.' });
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Brochure image proxy failed:', error);
    res.status(500).json({ error: 'Failed to proxy image.' });
  }
}
