# kileymeehan.com — redesign

Personal portfolio site for Kiley Meehan, Senior Director of Design at FreshBooks.

## Design direction

**Refined editorial.** The previous site leaned into brutalist/loud design (heavy borders,
dot-grid backgrounds, halftone photo, aggressive orange). This redesign strips the noise
and trusts typography and whitespace to do the work.

### Aesthetic principles
- Warm off-white paper background (`#faf9f7`), not stark white
- Playfair Display for all display type (serif, editorial weight)
- DM Sans at light/regular weight for body — never bold-heavy
- Muted amber accent (`#c17f3a`) used sparingly: eyebrows, tags, divider ticks
- Hairline borders and rules (`1px solid #e8e4de`) instead of heavy black outlines
- Generous whitespace; let content breathe
- No decorative effects — no gradients, dot grids, halftones, or drop shadows

### Tone
Confident but understated. The person behind the site is a writer and thinker, not just
a PM/design executive. The site should feel like it belongs in an editorial context.

## File structure

```
index.html          — main page (single-page for now)
css/style.css       — all styles, CSS custom properties at :root
js/main.js          — minimal JS: scroll nav state, fade-in observer
assets/             — put hero-photo.jpg here (replace placeholder)
```

## Current sections (index.html)

1. **Nav** — sticky, logo left, links right
2. **Hero** — two-column: text left, photo right
3. **Featured project** — Blupi card
4. **Testimonials** — 2×2 grid
5. **Footer** — connect links

## To-do / next steps for Claude Code

- [ ] Add `assets/hero-photo.jpg` — actual photo, no halftone treatment
- [ ] Add fade-in CSS to complement the JS observer (`.fade-target`, `.is-visible`)
- [ ] Add a Writing section linking to Of Quality newsletter
- [ ] Add a more detailed Work section (FreshBooks case studies, etc.)
- [ ] Consider adding a dark mode (`prefers-color-scheme: dark`) token set
- [ ] Add Open Graph image (`assets/og-image.jpg`, 1200×630)
- [ ] Wire up real social/email URLs in footer and nav

## CSS tokens (quick reference)

```css
--ink:        #1a1814   /* primary text */
--ink-soft:   #6b6760   /* secondary text */
--ink-muted:  #9e9b96   /* tertiary / labels */
--paper:      #faf9f7   /* background */
--warm-line:  #e8e4de   /* borders and rules */
--accent:     #c17f3a   /* amber accent */
```

## Fonts

Loaded from Google Fonts:
- `Playfair Display` — 400 regular, 400 italic, 500 medium
- `DM Sans` — 300 light, 400 regular, 500 medium

## Notes

- Keep JS minimal. This is a static site, not a React app.
- Responsive breakpoints are at 900px and 600px.
- The nav goes sticky on scroll — `.is-scrolled` class is toggled via JS for any
  additional styling hooks needed (e.g. border, background opacity).
- Testimonial quotes use `<blockquote>` semantically.
