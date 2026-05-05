/**
 * Higgsfield API proxy — Vercel serverless function.
 *
 * Frontend speaks ONE shape:
 *   POST /api/higgsfield  body:
 *     { op: 'submit', task, model, params }   -> { id, status }
 *     { op: 'status', id }                    -> { id, status, output_urls?, error? }
 *     { op: 'cancel', id }                    -> { ok: true }
 *     { op: 'ping' }                          -> { ok: true } if key is set, else 500
 *
 * Upstream contract (per Higgsfield docs, may be tuned in one place if their
 * actual contract differs):
 *   POST   {BASE}/generations            { task, model, ...params }
 *   GET    {BASE}/generations/{id}
 *   DELETE {BASE}/generations/{id}
 *   Auth:  Authorization: Bearer ${HIGGSFIELD_API_KEY}
 */

const BASE = process.env.HIGGSFIELD_API_BASE || 'https://api.higgsfield.ai/v1';
const KEY_NAME = 'HIGGSFIELD_API_KEY';

module.exports = async function handler(req, res) {
    return res.json({ ok: true });
};

        const { op } = body;

        if (op === 'ping') {
            // Cheap health-check — never hits upstream, just confirms the key is wired.
            return res.status(200).json({ ok: true });
        }

        if (op === 'submit') {
            const { task, model, params } = body;
            if (!task) return res.status(400).json({ error: 'Missing task' });

            const upstreamBody = { task, model, ...(params || {}) };
            const r = await fetch(`${BASE}/generations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(upstreamBody)
            });

            const text = await r.text();
            const data = safeJson(text);

            if (!r.ok) {
                return res.status(r.status).json({
                    error: data?.error || data?.message || 'Higgsfield submit failed',
                    status: r.status,
                    body: data ?? text.slice(0, 600)
                });
            }

            const id = data?.id || data?.generation_id || data?.job_id || data?.task_id;
            const status = data?.status || 'queued';
            if (!id) {
                return res.status(502).json({ error: 'No id returned by Higgsfield', body: data });
            }
            return res.status(200).json({ id, status, raw: data });
        }

        if (op === 'status') {
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'Missing id' });
            const r = await fetch(`${BASE}/generations/${encodeURIComponent(id)}`, {
                method: 'GET',
                headers
            });
            const text = await r.text();
            const data = safeJson(text);
            if (!r.ok) {
                return res.status(r.status).json({
                    error: data?.error || data?.message || 'Higgsfield status failed',
                    status: r.status,
                    body: data ?? text.slice(0, 600)
                });
            }
            // Normalise the output URLs across possible upstream shapes.
            const urls = extractUrls(data);
            return res.status(200).json({
                id,
                status: data?.status || 'unknown',
                output_urls: urls,
                error: data?.error,
                raw: data
            });
        }

        if (op === 'cancel') {
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'Missing id' });
            const r = await fetch(`${BASE}/generations/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers
            });
            // Treat any 2xx as success; some APIs return 204 with no body.
            if (!r.ok && r.status !== 204) {
                const text = await r.text();
                return res.status(r.status).json({
                    error: 'Cancel failed',
                    status: r.status,
                    body: safeJson(text) ?? text.slice(0, 600)
                });
            }
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: `Unknown op: ${op}` });
    } catch (e) {
        return res.status(500).json({
            error: 'Handler crashed',
            message: e.message,
            stack: e.stack?.split('\n').slice(0, 4).join('\n')
        });
    }
};

function safeJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
}

function extractUrls(data) {
    if (!data) return [];
    // Try common output shapes used by generative APIs.
    if (Array.isArray(data.output_urls)) return data.output_urls;
    if (Array.isArray(data.urls)) return data.urls;
    if (Array.isArray(data.outputs)) {
        return data.outputs
            .map(o => o?.url || o?.output_url || (typeof o === 'string' ? o : null))
            .filter(Boolean);
    }
    if (typeof data.output_url === 'string') return [data.output_url];
    if (typeof data.url === 'string') return [data.url];
    if (typeof data.output === 'string') return [data.output];
    if (data.result?.url) return [data.result.url];
    if (Array.isArray(data.result?.images)) return data.result.images.map(i => i.url || i).filter(Boolean);
    if (Array.isArray(data.images)) return data.images.map(i => i.url || i).filter(Boolean);
    return [];
}
