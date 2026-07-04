// Shared guestbook for the collective poem — a Vercel serverless function.
//
// Storage: Upstash Redis over REST. In Vercel: Marketplace → Upstash →
// create a free Redis database and connect it to this project. That injects
// the two env vars used below (KV_REST_API_URL, KV_REST_API_TOKEN) — they
// live ONLY in Vercel, never in this repo.
//
// Until those env vars exist this endpoint answers 503 and the site
// automatically falls back to per-browser localStorage, so deploying
// without the database is completely safe.

const KEY = 'fragments:guestbook';
const MAX_LINES = 200; // wall keeps the most recent 200 transmissions
const MAX_LEN = 90; // must match the input's maxlength in the page
const RATE_LIMIT = 5; // posts per IP per minute
// control chars (U+0000-U+001F, U+007F) built via charcodes to keep this
// source file free of raw control bytes.
const CTRL_CHARS = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');

async function redis(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(url + '/' + command.map(encodeURIComponent).join('/'), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) throw new Error('kv responded ' + res.status);
  return (await res.json()).result;
}

module.exports = async (req, res) => {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    res.status(503).json({ error: 'guestbook storage not configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const lines = (await redis(['LRANGE', KEY, '0', String(MAX_LINES - 1)])) || [];
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ lines });
      return;
    }

    if (req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
      const rlKey = 'fragments:rl:' + ip;
      const hits = await redis(['INCR', rlKey]);
      if (Number(hits) === 1) await redis(['EXPIRE', rlKey, '60']);
      if (Number(hits) > RATE_LIMIT) {
        res.status(429).json({ error: 'slow down — the wall can wait a minute' });
        return;
      }

      let line = req.body && req.body.line;
      if (typeof line !== 'string') {
        res.status(400).json({ error: 'expected { "line": "..." }' });
        return;
      }
      // Strip control characters, collapse whitespace, cap length. Stored
      // as plain text and rendered as plain text, so markup stays inert.
      line = line.replace(CTRL_CHARS, ' ').replace(/ +/g, ' ').trim().slice(0, MAX_LEN);
      if (!line) {
        res.status(400).json({ error: 'empty line' });
        return;
      }

      await redis(['RPUSH', KEY, line]);
      await redis(['LTRIM', KEY, String(-MAX_LINES), '-1']);
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'storage error' });
  }
};
