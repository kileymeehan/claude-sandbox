# Songbook

A local-first songwriter's workbook for writing lyrics, annotating chords, managing albums, and building mood boards. All data lives in the browser — no backend, no account required.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v3 (utilities) + custom CSS variables (editorial design system) |
| Local storage | IndexedDB via the `idb` wrapper library |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Fonts | Google Fonts (Playfair Display, Inter, and 5 optional lyric fonts loaded on demand) |
| External APIs | Datamuse (rhyme suggestions, no key required), lyrics.ovh (lyrics import for covers, no key required) |
| Language | JavaScript (JSX), no TypeScript |
| Package manager | npm |
| Node version | 25.x (any modern Node ≥ 18 should work) |

---

## Project structure

```
songbook/
├── index.html                  # Entry point, Google Fonts preconnect
├── package.json
├── vite.config.js
├── tailwind.config.js
├── src/
│   ├── main.jsx                # React root mount
│   ├── App.jsx                 # Top-level state, routing between views
│   ├── db.js                   # All IndexedDB logic (songs, albums, audio blobs)
│   ├── fonts.js                # Font options + dynamic Google Fonts loader
│   ├── index.css               # Design system (CSS custom properties, dark/light themes, print styles)
│   └── components/
│       ├── Sidebar.jsx         # Navigation, search trigger, new song/album buttons
│       ├── SongList.jsx        # Library/Originals/Covers views with search and tag filtering
│       ├── SongEditor.jsx      # Main lyric editor with auto-save, section management, scratch pad
│       ├── SectionBlock.jsx    # Individual section (verse/chorus/etc.) with drag handle and chord tools
│       ├── LineEditor.jsx      # Single lyric line with chord annotation row and chord popover
│       ├── AlbumGrid.jsx       # Album overview grid
│       ├── AlbumDetail.jsx     # Album detail with cover art upload
│       ├── QuickSearch.jsx     # Cmd+K search modal — searches title, artist, album, tags
│       ├── RhymePanel.jsx      # Rhyme assistant sidebar (Datamuse API)
│       ├── NotesPanel.jsx      # Freewrite notes + mood board image uploads sidebar
│       ├── AudioPlayer.jsx     # Custom audio player (audio stored as IndexedDB blobs)
│       ├── CircleOfFifths.jsx  # SVG circle of fifths reference modal
│       ├── PrintView.jsx       # Print-formatted chord chart (letter portrait, browser print API)
│       └── Settings.jsx        # Theme toggle + lyric font picker
```

---

## Data model

All data is stored in a single IndexedDB database named `songbook-db`. Three object stores:

### `songs`
```js
{
  id: string,           // crypto.randomUUID()
  title: string,
  artist: string,
  type: 'original' | 'cover',
  albumId: string | null,
  tags: string[],
  notes: string,        // freewrite notes
  moodImages: [{ id, dataUrl }],  // base64 JPEG compressed to max 1400px
  sections: [
    {
      id: string,
      type: string,     // 'verse' | 'chorus' | 'bridge' | 'pre-chorus' | 'intro' | 'outro' | 'hook' | 'middle-eight' | 'custom'
      customLabel: string,
      lines: [
        {
          id: string,
          lyric: string,
          chords: [{ id, chord, position }]  // position = character index in lyric string
        }
      ]
    }
  ],
  createdAt: number,    // Date.now()
  updatedAt: number
}
```

### `albums`
```js
{
  id: string,
  title: string,
  artist: string,
  year: number,
  coverArt: string | null,  // base64 dataURL
  songIds: string[],
  createdAt: number
}
```

### `audio`
```js
{
  songId: string,
  blob: Blob,           // raw audio file, any format the browser supports
  savedAt: number
}
```

---

## Key behaviours

- **Auto-save** — 500ms debounce after any change. Force-save with Cmd+S.
- **Theme** — dark/light, persisted to `localStorage` under key `sb-theme`.
- **Font** — 7 lyric font options, persisted to `localStorage` under key `sb-font`. Non-default fonts are loaded from Google Fonts on first selection.
- **Chord positioning** — uses the browser Range API (`document.createRange()`) to convert pixel click positions to character indices, enabling accurate chord annotation over proportional serif fonts.
- **Section drag-to-reorder** — powered by `@dnd-kit` with a 5px activation distance to prevent accidental drags while typing.
- **Chord transposition** — semitone-by-semitone, per section, with a sharp/flat output toggle.
- **Print** — renders a letter-portrait chord chart with chords in monospace above lyrics in the chosen lyric font. Uses `@page { size: letter portrait; margin: 0.75in }`.

---

## Running locally

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

```bash
npm run build     # outputs to dist/
npm run preview   # serves the dist/ build locally
```

---

## Production hosting

This is a fully static app — `npm run build` produces a `dist/` folder of plain HTML, CSS, and JS with no server-side component. It can be deployed to any static file host:

**Easiest options:**
- **Netlify** — connect the repo, set build command `npm run build`, publish directory `dist`. Done.
- **Vercel** — same: import repo, framework preset "Vite", it detects the rest automatically.
- **Cloudflare Pages** — same pattern, very fast global CDN.
- **GitHub Pages** — use the `vite-plugin-gh-pages` package or a GitHub Action to push `dist/` to the `gh-pages` branch.

**Self-hosted / manual:**
- Upload the contents of `dist/` to any S3-compatible object storage (AWS S3, Cloudflare R2, GCS) configured for static website hosting.
- Or serve with any static file server (nginx, Caddy, etc.) — just point the root at `dist/` and add a catch-all redirect to `index.html` for client-side routing (not strictly needed since this app has no URL-based routing, but good practice).

**What you don't need:**
- No server process
- No database server
- No environment variables
- No build secrets

All user data stays in the visitor's browser IndexedDB. There is nothing to migrate, back up, or secure server-side.

**Outbound network calls (the only external dependencies at runtime):**
1. Google Fonts — on page load + when a new lyric font is selected for the first time
2. Datamuse API — rhyme suggestions, on demand, no API key
3. lyrics.ovh — cover lyrics import, on demand, no API key

---

## Future directions (if you want them)

| Feature | Approach |
|---|---|
| Export / backup | Read all IndexedDB records and download as a JSON file — no backend needed |
| Import / restore | Parse the JSON and write back to IndexedDB |
| Multi-device sync | Add a backend: Supabase, PocketBase, or Cloudflare D1 + a simple auth layer |
| Collaboration | Same backend path + real-time via Supabase Realtime or PartyKit |
| Mobile app | Wrap in Capacitor or Tauri for a native shell around the same web code |
