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

Dark mode: set `data-theme="dark"` on `<html>` (or add the `dark` class, for Tailwind/shadcn apps).

Each app gets a copy rather than a link so it deploys on its own. The
copy's first line records the design-system version. After changing
anything here, re-run the sync for each app that uses it.

## Adding a brand

Copy `brands/swatchbook.css`, set `--ds-accent` (primary actions, focus,
selection) and `--ds-pop` (button hover fill) for light and dark, and pass
the new name to `sync.mjs`.

## Palette

Since v2.0 the colours come from coral reefs, muted for everyday UI:
deep-sea ink on sand, reef-slate frames, and accents from soft and
sea-fan corals, anemones, lagoon water and reef fish. Every text pairing
meets WCAG AA (4.5:1).

| Role | Reef source | Token |
| --- | --- | --- |
| Ink, chrome | deep water | `--ds-ink` `#14242E` |
| Page | sand | `--ds-page` `#F6F2EC` |
| Info / Blupi primary | ocean | `--ds-info`, Blupi `--ds-accent` `#2E6A8E` |
| Pop / warning | yellow tang | `--ds-pop` `#E8C25E` |
| Danger | sea-fan red | `--ds-danger` `#B04A35` |
| Success | kelp | `--ds-success` `#3E8A68` |
| AI | anemone lilac | `--ds-ai-fg` `#6E5A96` |
| SwatchBook accent | coral | `#B1553E` |

Content swatches: `--ds-reef-coral`, `-rose`, `-gold`, `-lagoon`,
`-blue`, `-lilac`, `-kelp`, `-sand`.

References (colours sampled, images not included): Kiley's reef
illustration, plus Wikimedia Commons photos: Annella mollis sea fan,
Ras Muhammad (CC BY-SA 4.0); Soft coral at GB Reef (CC BY-SA 4.0);
Soft coral peach, Komodo (CC BY-SA 3.0); Palmate sea fan at Super Fan
Reef (CC BY-SA 4.0); Pink anemonefish in Heteractis magnifica
(CC BY-SA 3.0); Coral Outcrop Flynn Reef (CC BY-SA 3.0).

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
| Blupi | `blupi` | `client/src/ds.css` and `chrome-extension/ds.css`. shadcn theme variables mirror the tokens as HSL; Tailwind has a `ds-*` colour namespace plus reef gray/status scales in `tailwind.config.ts`. |
