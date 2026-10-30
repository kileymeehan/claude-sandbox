# Design system

Shared tokens and components for the apps in `claude-sandbox`, extracted
from Blupi. Plain CSS, so it works in plain-HTML apps (SwatchBook) and in
React/Tailwind apps (Blupi) alike.

**Style guide:** `npm run guide`, then open http://localhost:8110. Every
token and component, switchable between brands and light/dark.

## Files

| File | What it is |
| --- | --- |
| `tokens.css` | Type, spacing, shape, motion and colour variables (`--ds-*`), light and `[data-theme="dark"]` |
| `components.css` | `ds-` classes: cards, buttons, forms, tables, pills, tags, chips, menus, dialogs, chrome |
| `brands/*.css` | Per-app accent overrides (Blupi blue + yellow, SwatchBook indigo) |
| `tailwind-preset.cjs` | The tokens as Tailwind theme values |
| `scripts/sync.mjs` | Copies tokens + components + a brand into an app as one `ds.css` |
| `index.html` | The style guide |

## Using it in an app

```
node scripts/sync.mjs ../inspo-browser/public/ds.css swatchbook
```

```html
<link rel="stylesheet" href="ds.css">
<body class="ds-root ds-page">
```

Dark mode: set `data-theme="dark"` on `<html>`.

Each app gets a copy rather than a link so it deploys on its own. The
copy's first line records the design-system version. After changing
anything here, re-run the sync for each app that uses it.

## Adding a brand

Copy `brands/swatchbook.css`, set `--ds-accent` (primary actions, focus,
selection) and `--ds-pop` (button hover fill) for light and dark, and pass
the new name to `sync.mjs`.

## Principles

1. One strong frame per section; quiet insides (hairlines, no boxes in boxes).
2. One loud action per section; secondary actions are ghost or icon-only.
3. Uppercase for labels, section titles and buttons; content in sentence case.
4. Colour carries meaning (status, AI, danger, brand), not decoration.
5. Apps share shape, type and spacing; each keeps its own accent.

## Used by

| App | Brand | Copy |
| --- | --- | --- |
| SwatchBook (`inspo-browser`) | `swatchbook` | `public/ds.css` |
| Blupi | `blupi` | Source of these patterns. Its own CSS predates the system; migrate to `ds.css` + the Tailwind preset when convenient. |
