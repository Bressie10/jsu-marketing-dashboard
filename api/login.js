module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { username, password } = body || {};
  const validUser = process.env.DASHBOARD_USERNAME;
  const validPass = process.env.DASHBOARD_PASSWORD;
  const token = process.env.DASHBOARD_TOKEN;

  if (!validUser || !validPass || !token) {
    return res.status(500).json({ error: 'Auth not configured on server' });
  }

  if (username === validUser && password === validPass) {
    return res.status(200).json({ token });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
};
