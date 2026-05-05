/**
 * Higgsfield API proxy — Vercel serverless function.
 */

const BASE = process.env.HIGGSFIELD_API_BASE || "https://platform.higgsfield.ai";
const KEY_NAME = "HIGGSFIELD_API_KEY";

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Missing body" });
    }

    const key = process.env[KEY_NAME];
    if (!key) {
      return res
        .status(500)
        .json({ error: `${KEY_NAME} is not set on Vercel` });
    }

    const headers = {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const { op } = body;

    // ✅ HEALTH CHECK (must NOT hit upstream)
    if (op === "ping") {
      return res.status(200).json({ ok: true });
    }

    // ✅ SUBMIT GENERATION
    if (op === "submit") {
      const { application, arguments: args } = body;
      if (!application) return res.status(400).json({ error: "Missing application" });

      const upstreamBody = { application, arguments: args || {} };

      const r = await fetch(`${BASE}/requests`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
      });

      const text = await r.text();
      const data = safeJson(text);

      if (!r.ok) {
        return res.status(r.status).json({
          error: data?.error || data?.message || "Higgsfield submit failed",
          status: r.status,
          body: data ?? text.slice(0, 600),
        });
      }

      const id =
        data?.id || data?.generation_id || data?.job_id || data?.task_id;

      if (!id) {
        return res.status(502).json({
          error: "No id returned by Higgsfield",
          body: data,
        });
      }

      return res.status(200).json({
        id,
        status: data?.status || "queued",
        raw: data,
      });
    }

    // ✅ STATUS CHECK
    if (op === "status") {
      const { id } = body;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const r = await fetch(`${BASE}/requests/${encodeURIComponent(id)}/status`, {
	        method: "GET",
        headers,
      });

      const text = await r.text();
      const data = safeJson(text);

      if (!r.ok) {
        return res.status(r.status).json({
          error: data?.error || data?.message || "Higgsfield status failed",
          status: r.status,
          body: data ?? text.slice(0, 600),
        });
      }

      return res.status(200).json({
        id,
        status: data?.status || "unknown",
        output_urls: extractUrls(data),
        error: data?.error,
        raw: data,
      });
    }

    // ✅ CANCEL
    if (op === "cancel") {
      const { id } = body;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const r = await fetch(`${BASE}/requests/${encodeURIComponent(id)}/cancel`, {
	        method: "DELETE",
        headers,
      });

      if (!r.ok && r.status !== 204) {
        const text = await r.text();
        return res.status(r.status).json({
          error: "Cancel failed",
          status: r.status,
          body: safeJson(text) ?? text.slice(0, 600),
        });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown op: ${op}` });
  } catch (e) {
    return res.status(500).json({
      error: "Handler crashed",
      message: e.message,
      stack: e.stack?.split("\n").slice(0, 4).join("\n"),
    });
  }
};

// ---------------- helpers ----------------

function safeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractUrls(data) {
  if (!data) return [];

  if (Array.isArray(data.output_urls)) return data.output_urls;
  if (Array.isArray(data.urls)) return data.urls;

  if (Array.isArray(data.outputs)) {
    return data.outputs
      .map((o) => o?.url || o?.output_url || (typeof o === "string" ? o : null))
      .filter(Boolean);
  }

  if (typeof data.output_url === "string") return [data.output_url];
  if (typeof data.url === "string") return [data.url];
  if (typeof data.output === "string") return [data.output];

  if (data.result?.url) return [data.result.url];

  if (Array.isArray(data.result?.images)) {
    return data.result.images.map((i) => i.url || i).filter(Boolean);
  }

  if (Array.isArray(data.images)) {
    return data.images.map((i) => i.url || i).filter(Boolean);
  }

  return [];
}
