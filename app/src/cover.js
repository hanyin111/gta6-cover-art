// Vice Frame renderer.
//
// Draws a GTA-style multi-panel cover onto a 2D canvas: photo panels cut by
// slanted dividers with thick near-black gutters, a colour grade with a
// vertical tint wash, an optional striped retro sun, a rotated caption block
// (accent bar, letterspaced kicker, big outlined display title), a vignette
// and a double poster frame. Pure canvas, no dependencies.
//
// A "slot" is { img, dx, dy, zoom }: the photo plus its crop. dx/dy are
// fractions of the cover-fit slack, in [-0.5, 0.5]; 0 centres the photo.
// Because the offsets are applied as (0.5 + d) * slack, a photo clamped to
// that range can never be dragged off its panel.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080×1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080×1350' },
  landscape: { w: 1920, h: 1080, label: 'Landscape 1920×1080' },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.28) contrast(1.07)',
    tintTop: 'rgba(255,110,64,0.20)',
    tintBottom: 'rgba(94,23,143,0.26)',
    sun: ['#ffd76e', '#ff5e8a'],
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.35) contrast(1.12)',
    tintTop: 'rgba(0,229,255,0.14)',
    tintBottom: 'rgba(255,0,128,0.22)',
    sun: ['#7df9ff', '#ff2ea6'],
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(0.85) contrast(1.18)',
    tintTop: 'rgba(255,255,255,0.06)',
    tintBottom: 'rgba(0,0,0,0.30)',
    sun: ['#f5f5f5', '#9e9e9e'],
  },
  clean: {
    label: 'Clean',
    filter: 'saturate(1.08) contrast(1.03)',
    tintTop: 'rgba(255,255,255,0.05)',
    tintBottom: 'rgba(20,20,40,0.10)',
    sun: ['#ffe9a8', '#ffb36e'],
  },
};

export const ACCENTS = ['#ff2e88', '#ffb300', '#00e5ff', '#ff4d2e', '#b6ff2e'];

// Panel polygons in normalised [0,1] coordinates, one array per layout.
export function layoutPanels(name, aspect) {
  if (name === 'duo') {
    return [
      [[0, 0], [1, 0], [1, 0.40], [0, 0.64]],
      [[0, 0.64], [1, 0.40], [1, 1], [0, 1]],
    ];
  }
  if (name === 'hero') {
    return [
      [[0, 0], [1, 0], [1, 1], [0, 1]],
      [[0.585, 0.575], [1, 0.545], [1, 1], [0.615, 1]],
    ];
  }
  // grid: five panels split by a waist line whose height follows the aspect.
  const waist = aspect < 0.9 ? 0.46 : 0.52;
  return [
    [[0, 0], [0.615, 0], [0.575, waist], [0, waist]],
    [[0.615, 0], [1, 0], [1, waist], [0.575, waist]],
    [[0, waist], [0.395, waist], [0.43, 1], [0, 1]],
    [[0.395, waist], [1, waist], [1, 0.775], [0.412, 0.775]],
    [[0.412, 0.775], [1, 0.775], [1, 1], [0.43, 1]],
  ];
}

function bbox(poly) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

// Cover-fit geometry for an image inside a pixel box at a zoom level.
export function fitFor(img, bw, bh, zoom) {
  const z = Math.max(1, zoom || 1);
  const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * z;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  return { dw, dh, slackX: Math.max(0, dw - bw), slackY: Math.max(0, dh - bh) };
}

export function clampCrop(slot) {
  slot.dx = Math.min(0.5, Math.max(-0.5, slot.dx || 0));
  slot.dy = Math.min(0.5, Math.max(-0.5, slot.dy || 0));
  slot.zoom = Math.min(3, Math.max(1, slot.zoom || 1));
  return slot;
}

function tracePath(ctx, poly, W, H) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * W, y * H);
    else ctx.lineTo(x * W, y * H);
  });
  ctx.closePath();
}

function drawPanel(ctx, poly, slot, grade, W, H) {
  const b = bbox(poly);
  const bx = b.x0 * W, by = b.y0 * H;
  const bw = (b.x1 - b.x0) * W, bh = (b.y1 - b.y0) * H;
  ctx.save();
  tracePath(ctx, poly, W, H);
  ctx.clip();
  if (slot && slot.img) {
    const fit = fitFor(slot.img, bw, bh, slot.zoom);
    const ox = (0.5 + (slot.dx || 0)) * fit.slackX;
    const oy = (0.5 + (slot.dy || 0)) * fit.slackY;
    ctx.filter = grade.filter;
    ctx.drawImage(slot.img, bx - ox, by - oy, fit.dw, fit.dh);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, '#23233a');
    g.addColorStop(1, '#0d0d16');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
  }
  ctx.restore();
}

// The striped retro sun is composed on its own canvas first: cutting the
// stripes with destination-out on the main canvas would erase the photo
// underneath, so the disc is built offscreen and stamped on whole.
function makeSun(radius, colours) {
  const d = Math.ceil(radius * 2);
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(radius, radius, radius, 0, Math.PI * 2);
  g.clip();
  const grad = g.createLinearGradient(0, 0, 0, d);
  grad.addColorStop(0, colours[0]);
  grad.addColorStop(1, colours[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, d, d);
  g.globalCompositeOperation = 'destination-out';
  let y = radius * 1.04;
  let t = radius * 0.05;
  while (y < d) {
    g.fillRect(0, y, d, t);
    y += t + radius * 0.17;
    t *= 1.55;
  }
  return c;
}

function drawCaption(ctx, state, W, H) {
  const title = (state.title || '').trim();
  const kicker = (state.kicker || '').trim();
  if (!title && !kicker) return;
  // Fit the title to at most 88% of the width.
  let size = W * 0.115;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  const tw = title ? ctx.measureText(title.toUpperCase()).width : 0;
  if (tw > W * 0.88) {
    size *= (W * 0.88) / tw;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  const kickerSize = Math.max(11, size * 0.30);
  const barH = size * 0.15;
  const gapK = size * 0.18;
  const gapB = size * 0.22;
  ctx.save();
  ctx.translate(W * 0.055, H * 0.905);
  ctx.rotate(-0.045);
  ctx.textBaseline = 'alphabetic';
  // Accent bar above the kicker.
  ctx.fillStyle = state.accent;
  const topY = -(size + gapK + kickerSize + gapB + barH);
  ctx.fillRect(0, topY, W * 0.062, barH);
  // Kicker: letterspaced, in the accent colour.
  if (kicker) {
    ctx.font = `700 ${kickerSize}px 'Segoe UI', system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(kickerSize * 0.34)}px`; } catch (e) { /* older engines */ }
    ctx.fillStyle = state.accent;
    ctx.fillText(kicker.toUpperCase(), 2, -(size + gapK));
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  }
  // Title: hard offset shadow, thick dark outline, white fill.
  if (title) {
    const text = title.toUpperCase();
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(text, size * 0.05, size * 0.05);
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.17;
    ctx.strokeStyle = '#0a0a0a';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

// Render the whole cover. ctx is a 2D context of a W×H canvas; state is
// { layout, grade, accent, title, kicker, sun, slots } where slots[i] is the
// crop for panel i (the last slot repeats if a layout has more panels).
export function renderCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.save();
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);
  const panels = layoutPanels(state.layout, W / H);
  panels.forEach((poly, i) => {
    const slot = state.slots[Math.min(i, state.slots.length - 1)];
    drawPanel(ctx, poly, slot, grade, W, H);
  });
  // Thick near-black gutters along every divider.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0b0b10';
  ctx.lineWidth = Math.max(6, W * 0.0085);
  for (const poly of panels) {
    tracePath(ctx, poly, W, H);
    ctx.stroke();
  }
  // Vertical tint wash over the whole collage.
  const tint = ctx.createLinearGradient(0, 0, 0, H);
  tint.addColorStop(0, grade.tintTop);
  tint.addColorStop(0.45, 'rgba(0,0,0,0)');
  tint.addColorStop(1, grade.tintBottom);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  // Retro sun, top right.
  if (state.sun) {
    const r = W * 0.072;
    const sun = makeSun(r, grade.sun);
    ctx.globalAlpha = 0.92;
    ctx.drawImage(sun, W * 0.868 - r, H * 0.128 - r);
    ctx.globalAlpha = 1;
  }
  drawCaption(ctx, state, W, H);
  // Vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.74);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // Double poster frame: dark outer line, light inner line.
  ctx.strokeStyle = '#060608';
  ctx.lineWidth = Math.max(8, W * 0.012);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, W * 0.0035);
  const inset = W * 0.017;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();
}

// Which panel (if any) holds the normalised point (nx, ny)? Later panels are
// drawn on top, so they win the pick.
export function pickPanel(panels, nx, ny) {
  for (let i = panels.length - 1; i >= 0; i--) {
    const poly = panels[i];
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [ax, ay] = poly[a];
      const [bx, by] = poly[b];
      if ((ay > ny) !== (by > ny) && nx < ((bx - ax) * (ny - ay)) / (by - ay) + ax) {
        inside = !inside;
      }
    }
    if (inside) return i;
  }
  return -1;
}
