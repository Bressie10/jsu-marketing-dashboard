/**
 * ElevenLabs API proxy — Vercel serverless function.
 * API key is read from ELEVENLABS_API_KEY env var — never sent to the client.
 */

const BASE = 'https://api.elevenlabs.io';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured on Vercel' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing body' });

  const { op } = body;
  const jsonHeaders = { 'xi-api-key': key, 'Content-Type': 'application/json' };
  const getHeaders = { 'xi-api-key': key };

  try {
    if (op === 'voices') {
      const r = await fetch(`${BASE}/v1/voices`, { headers: getHeaders });
      return res.status(r.status).json(await r.json());
    }

    if (op === 'models') {
      const r = await fetch(`${BASE}/v1/models`, { headers: getHeaders });
      return res.status(r.status).json(await r.json());
    }

    if (op === 'subscription') {
      const r = await fetch(`${BASE}/v1/user/subscription`, { headers: getHeaders });
      return res.status(r.status).json(await r.json());
    }

    if (op === 'history') {
      const { pageSize, startAfter } = body;
      let url = `${BASE}/v1/history?page_size=${pageSize || 50}`;
      if (startAfter) url += `&start_after_history_item_id=${encodeURIComponent(startAfter)}`;
      const r = await fetch(url, { headers: getHeaders });
      return res.status(r.status).json(await r.json());
    }

    if (op === 'delete_history') {
      const { historyItemId } = body;
      if (!historyItemId) return res.status(400).json({ error: 'Missing historyItemId' });
      const r = await fetch(`${BASE}/v1/history/items/${historyItemId}`, {
        method: 'DELETE', headers: getHeaders
      });
      return res.status(200).json({ ok: r.ok || r.status === 204 });
    }

    if (op === 'history_audio') {
      const { historyItemId } = body;
      if (!historyItemId) return res.status(400).json({ error: 'Missing historyItemId' });
      const r = await fetch(`${BASE}/v1/history/${historyItemId}/audio`, { headers: getHeaders });
      if (!r.ok) return res.status(r.status).json({ error: 'Audio fetch failed' });
      const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: buf.toString('base64'), contentType: 'audio/mpeg' });
    }

    if (op === 'tts') {
      const { voiceId, text, modelId, stability, similarityBoost, style, useSpeakerBoost } = body;
      if (!voiceId || !text) return res.status(400).json({ error: 'Missing voiceId or text' });
      const r = await fetch(`${BASE}/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          text,
          model_id: modelId || 'eleven_multilingual_v2',
          voice_settings: {
            stability: (stability ?? 50) / 100,
            similarity_boost: (similarityBoost ?? 75) / 100,
            style: (style ?? 0) / 100,
            use_speaker_boost: useSpeakerBoost ?? true
          }
        })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err?.detail?.message || err?.message || 'TTS failed', detail: err });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: buf.toString('base64'), contentType: 'audio/mpeg' });
    }

    if (op === 'sfx') {
      const { text, durationSeconds, promptInfluence } = body;
      if (!text) return res.status(400).json({ error: 'Missing text' });
      const sfxBody = { text };
      if (durationSeconds != null) sfxBody.duration_seconds = durationSeconds;
      if (promptInfluence != null) sfxBody.prompt_influence = promptInfluence;
      const r = await fetch(`${BASE}/v1/sound-generation`, {
        method: 'POST', headers: jsonHeaders, body: JSON.stringify(sfxBody)
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err?.detail?.message || 'SFX generation failed', detail: err });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: buf.toString('base64'), contentType: 'audio/mpeg' });
    }

    if (op === 'clone') {
      const { name, description, files, labels } = body;
      if (!name || !files?.length) return res.status(400).json({ error: 'Missing name or files' });
      const fd = new FormData();
      fd.append('name', name);
      if (description) fd.append('description', description);
      if (labels && Object.keys(labels).length > 0) fd.append('labels', JSON.stringify(labels));
      for (const f of files) {
        const buf = Buffer.from(f.base64, 'base64');
        fd.append('files', new Blob([buf], { type: f.mimeType || 'audio/mpeg' }), f.name || 'sample.mp3');
      }
      const r = await fetch(`${BASE}/v1/voices/add`, {
        method: 'POST', headers: { 'xi-api-key': key }, body: fd
      });
      return res.status(r.status).json(await r.json().catch(() => ({})));
    }

    if (op === 's2s') {
      const { voiceId, audioFile, modelId, stability, similarityBoost, style, useSpeakerBoost } = body;
      if (!voiceId || !audioFile) return res.status(400).json({ error: 'Missing voiceId or audioFile' });
      const fd = new FormData();
      const buf = Buffer.from(audioFile.base64, 'base64');
      fd.append('audio', new Blob([buf], { type: audioFile.mimeType || 'audio/mpeg' }), audioFile.name || 'input.mp3');
      fd.append('model_id', modelId || 'eleven_multilingual_sts_v2');
      fd.append('voice_settings', JSON.stringify({
        stability: (stability ?? 50) / 100,
        similarity_boost: (similarityBoost ?? 75) / 100,
        style: (style ?? 0) / 100,
        use_speaker_boost: useSpeakerBoost ?? true
      }));
      const r = await fetch(`${BASE}/v1/speech-to-speech/${voiceId}`, {
        method: 'POST', headers: { 'xi-api-key': key }, body: fd
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err?.detail?.message || 'S2S failed', detail: err });
      }
      const outBuf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: outBuf.toString('base64'), contentType: 'audio/mpeg' });
    }

    if (op === 'isolation') {
      const { audioFile } = body;
      if (!audioFile) return res.status(400).json({ error: 'Missing audioFile' });
      const fd = new FormData();
      const buf = Buffer.from(audioFile.base64, 'base64');
      fd.append('audio', new Blob([buf], { type: audioFile.mimeType || 'audio/mpeg' }), audioFile.name || 'input.mp3');
      const r = await fetch(`${BASE}/v1/audio-isolation`, {
        method: 'POST', headers: { 'xi-api-key': key }, body: fd
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err?.detail?.message || 'Isolation failed', detail: err });
      }
      const outBuf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: outBuf.toString('base64'), contentType: 'audio/mpeg' });
    }

    if (op === 'voice_preview') {
      const { previewUrl } = body;
      if (!previewUrl) return res.status(400).json({ error: 'Missing previewUrl' });
      const r = await fetch(previewUrl);
      if (!r.ok) return res.status(r.status).json({ error: 'Preview not found' });
      const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ audio: buf.toString('base64'), contentType: 'audio/mpeg' });
    }

    return res.status(400).json({ error: `Unknown op: ${op}` });
  } catch (e) {
    return res.status(500).json({
      error: 'Handler crashed', message: e.message,
      stack: e.stack?.split('\n').slice(0, 4).join('\n')
    });
  }
};
