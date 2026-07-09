// Shared guestbook for the collective poem — a Vercel serverless function.
//
// Storage: Supabase Postgres through the REST API.
// Required Vercel env vars:
// - SUPABASE_URL (example: https://xxxx.supabase.co)
// - SUPABASE_SERVICE_ROLE_KEY (server-side only)
// Optional env var:
// - SUPABASE_GUESTBOOK_TABLE (default: guestbook_lines)
//
// Until those env vars exist this endpoint answers 503 and the site
// automatically falls back to per-browser localStorage, so deploying
// without the database is still safe.

const MAX_LINES = 200; // wall keeps the most recent 200 transmissions
const MAX_LEN = 90; // must match the input's maxlength in the page

// control chars (U+0000-U+001F, U+007F) built via charcodes to keep this
// source file free of raw control bytes.
const CTRL_CHARS = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');

function supabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    table: process.env.SUPABASE_GUESTBOOK_TABLE || 'guestbook_lines'
  };
}

async function supabaseRequest(path, options) {
  const cfg = supabaseConfig();
  const headers = {
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    ...(options && options.headers ? options.headers : {})
  };
  const res = await fetch(cfg.url + '/rest/v1/' + path, {
    ...(options || {}),
    headers
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error('supabase ' + res.status + ' ' + msg);
  }
  return res;
}

function sanitizeLine(line) {
  return line.replace(CTRL_CHARS, ' ').replace(/ +/g, ' ').trim().slice(0, MAX_LEN);
}

module.exports = async (req, res) => {
  const cfg = supabaseConfig();
  if (!cfg.url || !cfg.key) {
    res.status(503).json({ error: 'guestbook storage not configured' });
    return;
  }

  try {
    const tablePath = encodeURIComponent(cfg.table);

    if (req.method === 'GET') {
      const q = '?select=line,created_at&order=created_at.desc&limit=' + MAX_LINES;
      const response = await supabaseRequest(tablePath + q, { method: 'GET' });
      const rows = await response.json();
      const lines = Array.isArray(rows)
        ? rows.map(r => (r && typeof r.line === 'string' ? r.line : '')).filter(Boolean).reverse()
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

      await supabaseRequest(tablePath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify([{ line }])
      });

      // Keep only the newest MAX_LINES rows.
      // Supabase does not support TRIM on table rows directly; cleanup is
      // expected via cron/sql job if strict retention is required.
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'storage error' });
  }
};
