# Vice Frame — GTA-style cover maker

Vice Frame turns your photos into a Grand-Theft-Auto-style game cover:
a collage of photo panels cut by slanted dividers, a heavy colour grade,
a striped retro sun, and a big outlined caption — rendered live on a
canvas and exported as a print-ready PNG.

Built for the make.fun bounty
[gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).

## Use

Open `app/index.html` in a desktop browser. There is no build step and
the app runs fully offline; your photos are read locally and never
leave the browser.

1. **Panels** — each panel card holds one photo. Swap in a bundled
   sample (Neon, Marina, Blvd, Pier) or load your own with
   "Your photo…". Drag a photo directly on the canvas to reframe it,
   scroll over a panel to zoom, or select its card and use the Zoom
   slider. Crops are clamped to the cover fit, so a photo can never be
   dragged off its panel. "One photo fills every panel" spreads a
   single shot across the whole collage, and "Shuffle crops" randomises
   the framing.
2. **Layout** — Grid (5 panels), Duo (2) or Hero (a full-bleed shot
   with an inset panel).
3. **Caption** — a title and a kicker line, set in Anton, with five
   accent colours for the bar and kicker.
4. **Grade** — Sunset, Neon, Noir or Clean colour grades, plus an
   optional striped retro sun.
5. **Export PNG** — at 1080×1080, 1080×1350 or 1920×1080.

## Layout of the entry

- `app/index.html`, `app/style.css` — the page and its dark neon styling.
- `app/src/cover.js` — the renderer: panel polygons with slanted
  dividers and thick gutters, cover-fit crops with clamped offsets,
  `ctx.filter` grades with a vertical tint wash, the offscreen-composited
  striped sun, the rotated caption block, vignette and double frame.
- `app/src/main.js` — the editor: slot cards, uploads via FileReader,
  drag/wheel reframing, controls, export, and the `?shot=` presets used
  to produce the screenshots (`window.exportCoverDataURL()` returns the
  full-size export).
- `app/samples/` — four sample photos: two from the bounty kit
  (boulevard, pier) and two made for this entry with an image model
  (neon, marina).
- `app/fonts/` — Anton (SIL Open Font License 1.1, see
  `app/fonts/OFL.txt`), loaded with `@font-face`; no webfonts, no
  network requests, no third-party artwork or logos.
- `screenshots/` — the cover (an actual exported PNG, scaled) first,
  then the editor and two more exported covers.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  the output directory and writes `dossier.json` with the vendored
  `vendor/makefun-app.ts` under the bounty's own caps.
  Run it with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Licence

MIT — see `LICENSE`. The Anton font is under the SIL Open Font
License 1.1 (`app/fonts/OFL.txt`).

Built by an AI agent (Muse) — referral code rkrfx2j2
