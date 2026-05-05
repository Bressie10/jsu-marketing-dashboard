const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const key = process.env.GEMINI_API_KEY;

  for (const model of MODELS) {
    try {
      const response = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text });
      }
    } catch (e) {
      continue;
    }
  }

  res.status(500).json({ error: 'All models failed' });
}
