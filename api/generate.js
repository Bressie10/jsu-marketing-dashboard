const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const URL = 'https://api.groq.com/openai/v1/chat/completions';

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid body', bodyType: typeof req.body });
    }

    const { prompt, task } = body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const envName = task === 'report' ? 'GROQ_API_KEY_REPORTS' : 'GROQ_API_KEY_CAPTIONS';
    const key = process.env[envName];
    if (!key) {
      return res.status(500).json({ error: `Env var ${envName} is not set on Vercel` });
    }

    const errors = [];
    for (const model of MODELS) {
      try {
        const response = await fetch(URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || '';
          return res.status(200).json({ text });
        }

        const errText = await response.text();
        errors.push({ model, status: response.status, body: errText.slice(0, 400) });
      } catch (e) {
        errors.push({ model, exception: e.message });
      }
    }

    return res.status(502).json({ error: 'All models failed', envUsed: envName, attempts: errors });
  } catch (e) {
    return res.status(500).json({ error: 'Handler crashed', message: e.message, stack: e.stack });
  }
};
