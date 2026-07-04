# fragments:// — your site

A funky CRT / terminal portfolio for your paintings, voice, and signal.
It's a plain static site — just HTML, a small runtime, and some images.
No build step, no framework.

## Folder layout

```
.
├── index.html            → entry point (redirect + social/SEO meta)
├── Fragments.dc.html     → the site itself (markup + logic)
├── favicon.svg           → browser-tab icon (blinking cursor)
├── api/
│   └── guestbook.js      → serverless function: shared guestbook storage
├── content/
│   ├── config.json       → YOUR editable content (links, paintings, tracks, gallery)
│   └── now.json          → what `aya --today` prints in the terminal
├── assets/
│   ├── bg-fragments.png  → background image (swap freely)
│   └── painting-01…06.svg→ placeholder paintings (replace with your own)
├── lib/
│   ├── support.js        → the runtime — don't edit
│   └── image-slot.js     → the image component — don't edit
└── README.md
```

Keep the folders as they are — the site loads files by these paths.

## The only file you edit day-to-day: `content/config.json`

Open it in any text editor. You can change everything here **without
touching code**.

```jsonc
{
  "links": {
    "soundcloud":    "https://soundcloud.com/vilaine_a",
    "spotify":       "https://open.spotify.com/show/2ULyziEPMffvgNC4WRTbvc",
    "spotify_title": "A's fragments"
  },
  "slam_audio": "assets/slam_fragment.mp3",
  "paintings": [
    { "file": "canvas_01.raw", "src": "assets/painting-01.jpg" }
    // ...add or remove as many as you like
  ],
  "tracks": [
    // the voice list — currently your Spotify episodes
    { "name": "لغةُ الندوب", "size": "6 min", "note": "Jun 17",
      "audio": "https://open.spotify.com/episode/1Z2AD0himcheX45CE4809D" }
  ]
}
```

- **`audio`** (on a track) can be a SoundCloud *or* Spotify link (track,
  episode, playlist, album, or your whole profile). Clicking a voice line
  opens a real embedded player at the bottom of the page and auto-plays.
- The **voice list** (`tracks`) is currently your 5 Spotify episodes.
  When you publish a new one, add a row here with its
  `open.spotify.com/episode/...` link.
- **`slam_audio`** is the spoken-word recording that plays when someone
  clicks ▶ perform on the slam fragment. See
  `assets/slam_fragment.README.txt` for how to add it.

## Adding your paintings

1. Drop your image files into `assets/` (e.g. `assets/painting-01.jpg`).
   PNG / JPG / WebP all work.
2. Point each painting's `"src"` in `content/config.json` at that file.

The `assets/painting-0N.svg` files are just placeholders — replace or
delete them once your real images are in.

- **Click a canvas** to open it full-screen (lightbox). Esc or click closes.
- Each canvas has a **⌖ scan** button — it reads the actual pixels of your
  painting and names its 3 dominant colors as acrylic pigments
  (yellow ochre, alizarin crimson, viridian…).

## The archive (layer 05)

When you have more paintings than the six canvas slots, add them to
`"gallery"` in `content/config.json`:

```jsonc
"gallery": [
  { "src": "assets/painting-07.jpg", "title": "untitled, red" },
  { "src": "assets/painting-08.jpg", "title": "الرماد" }
]
```

The **05·archive** layer (masonry grid + lightbox) and its nav link appear
automatically once this list is non-empty; with an empty list the site
looks exactly as before.

## Your voice / music

- Clicking any episode row in the **voice** section opens a real embedded
  player at the bottom of the page and **auto-plays** — pulled live from
  SoundCloud or Spotify.
- The footer has SoundCloud and Spotify icons linking to your accounts
  directly.

## Other content (optional)

- `content/now.json` — the reading / listening / painting / mood lines the
  terminal command `aya --today` prints. Edit anytime.
- The poem, terminal commands, boot text, taglines all live in
  `Fragments.dc.html`. Search for the text and edit in place:
  - poem → search `poem =`
  - terminal commands → search `runCommand`
  - CRT colour / scanlines / boot toggle → the `data-props` block near the
    bottom of the file.

## Running it locally

It needs to be served over http (opening the file directly won't load the
runtime). From this folder:

```bash
python -m http.server 4173
```

then open <http://localhost:4173/>.

## The shared guestbook (voices on the wall)

Out of the box, each visitor's lines only persist in their own browser.
To make the wall **shared across all visitors** (a true collective poem):

1. In your Vercel project: **Marketplace → Upstash → Redis** — create the
   free database and connect it to the project. This automatically adds
   two environment variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).
2. Redeploy. That's it — `api/guestbook.js` starts storing lines.

Security notes (why this is safe to keep public on GitHub):

- **No secrets in the repo.** The database credentials exist only as
  Vercel environment variables. Everything committed to GitHub is public
  site content.
- **Visitor input is inert.** Lines are capped at 90 chars, stripped of
  control characters, rate-limited (5/min per IP), and rendered as plain
  text — pasted HTML or scripts display as text, they never run.
- **No personal data.** No accounts, no names, no emails — nothing worth
  stealing. The wall keeps only the most recent 200 lines.

If you skip the database, everything still works — the wall just stays
per-browser like before.
