// Shared guestbook for the collective poem — a Vercel serverless function.
//
// Storage: Upstash Redis through the REST API.
// Required Vercel env vars:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN
// Optional env var:
// - UPSTASH_GUESTBOOK_KEY (default: guestbook_lines)
//
// Until those env vars exist this endpoint answers 503 and the site
// falls back to per-browser localStorage in local preview.

const MAX_LINES = 200; // wall keeps the most recent 200 transmissions
const MAX_LEN = 90; // must match the input's maxlength in the page

// control chars (U+0000-U+001F, U+007F) built via charcodes to keep this
// source file free of raw control bytes.
const CTRL_CHARS = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');

function upstashConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    key: process.env.UPSTASH_GUESTBOOK_KEY || 'guestbook_lines'
  };
}

async function upstashRequest(command, path) {
  const cfg = upstashConfig();
  const headers = {
    Authorization: 'Bearer ' + cfg.token,
    'Content-Type': 'application/json'
  };
  const res = await fetch(cfg.url + (path || ''), {
    method: 'POST',
    headers,
    body: JSON.stringify(command)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload && payload.error ? payload.error : 'request failed';
    throw new Error('upstash ' + res.status + ' ' + msg);
  }
  if (payload && payload.error) {
    throw new Error('upstash ' + payload.error);
  }
  return payload ? payload.result : undefined;
}

function sanitizeLine(line) {
  return line.replace(CTRL_CHARS, ' ').replace(/ +/g, ' ').trim().slice(0, MAX_LEN);
}

module.exports = async (req, res) => {
  const cfg = upstashConfig();
  if (!cfg.url || !cfg.token) {
    res.status(503).json({ error: 'guestbook storage not configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = await upstashRequest(['LRANGE', cfg.key, 0, MAX_LINES - 1]);
      const lines = Array.isArray(rows)
        ? rows.filter(line => typeof line === 'string' && line.trim()).reverse()
        : [];
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ lines });
      return;
    }

    if (req.method === 'POST') {
      let line = req.body && req.body.line;
      if (typeof line !== 'string') {
        res.status(400).json({ error: 'expected { "line": "..." }' });
        return;
      }

      line = sanitizeLine(line);
      if (!line) {
        res.status(400).json({ error: 'empty line' });
        return;
      }

      await upstashRequest(
        [
          ['LPUSH', cfg.key, line],
          ['LTRIM', cfg.key, 0, MAX_LINES - 1]
        ],
        '/multi-exec'
      );

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'storage error' });
  }
};
