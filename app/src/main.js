// Vice Frame editor: wires the page around the renderer in cover.js.
//
// Photos live in five slots; each slot's crop (dx, dy, zoom) is applied with
// cover-fit clamping, so a photo can be dragged and zoomed but never pulled
// off its panel. Uploads are read with FileReader and drawn from memory —
// nothing is uploaded anywhere. A ?shot=cover|editor query presets the whole
// state for screenshots, and window.exportCoverDataURL() hands out the
// full-size export PNG.

import { SIZES, GRADES, ACCENTS, layoutPanels, fitFor, clampCrop, renderCover, pickPanel } from './cover.js';

const SAMPLE_URLS = {
  neon: 'samples/neon.jpg',
  marina: 'samples/marina.jpg',
  boulevard: 'samples/boulevard.jpg',
  pier: 'samples/pier.jpg',
};
const SAMPLE_LABELS = { neon: 'Neon', marina: 'Marina', boulevard: 'Blvd', pier: 'Pier' };

const state = {
  layout: 'grid',
  size: 'square',
  grade: 'sunset',
  accent: '#ff2e88',
  title: 'Vice City',
  kicker: 'Stories from Leonida',
  sun: true,
  onePhoto: false,
  selected: 0,
  slots: [
    { sample: 'neon', img: null, thumb: null, label: 'Neon', dx: 0, dy: 0, zoom: 1 },
    { sample: 'marina', img: null, thumb: null, label: 'Marina', dx: 0, dy: 0, zoom: 1 },
    { sample: 'boulevard', img: null, thumb: null, label: 'Blvd', dx: 0, dy: 0.18, zoom: 1 },
    { sample: 'marina', img: null, thumb: null, label: 'Marina', dx: -0.28, dy: 0.05, zoom: 1 },
    { sample: 'neon', img: null, thumb: null, label: 'Neon', dx: -0.18, dy: 0, zoom: 1.35 },
  ],
};

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const sampleCache = new Map();
async function sampleImage(name) {
  if (!sampleCache.has(name)) sampleCache.set(name, await loadImage(SAMPLE_URLS[name]));
  return sampleCache.get(name);
}

function effSlot(i) {
  return state.onePhoto ? state.slots[0] : state.slots[i];
}

function renderState() {
  return {
    layout: state.layout,
    grade: state.grade,
    accent: state.accent,
    title: state.title,
    kicker: state.kicker,
    sun: state.sun,
    slots: state.slots.map((_, i) => effSlot(i)),
  };
}

function render() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(ctx, w, h, renderState());
}

function renderFull() {
  const { w, h } = SIZES[state.size];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  renderCover(c.getContext('2d'), w, h, renderState());
  return c;
}

window.exportCoverDataURL = () => renderFull().toDataURL('image/png');

/* ---------------- slot cards ---------------- */

const slotsEl = document.getElementById('slots');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.hidden = true;
document.body.appendChild(fileInput);
let uploadTarget = 0;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const url = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const slot = state.slots[uploadTarget];
  slot.img = await loadImage(url);
  slot.thumb = url;
  slot.label = 'Your photo';
  slot.sample = null;
  buildSlotCards();
  render();
});

function buildSlotCards() {
  slotsEl.innerHTML = '';
  const panelCount = layoutPanels(state.layout, 1).length;
  state.slots.forEach((slot, i) => {
    const card = document.createElement('div');
    card.className = 'slot' + (state.selected === i ? ' on' : '')
      + ((state.onePhoto && i > 0) || (!state.onePhoto && i >= panelCount) ? ' dim' : '');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.src = slot.thumb || (slot.sample ? SAMPLE_URLS[slot.sample] : '');
    card.appendChild(thumb);

    const body = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'slot-name';
    name.textContent = `Panel ${i + 1} · ${slot.label}`;
    body.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'slot-actions';
    for (const key of Object.keys(SAMPLE_URLS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mini-btn';
      b.textContent = SAMPLE_LABELS[key];
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        slot.img = await sampleImage(key);
        slot.sample = key;
        slot.thumb = null;
        slot.label = SAMPLE_LABELS[key];
        state.selected = i;
        buildSlotCards();
        syncZoom();
        render();
      });
      actions.appendChild(b);
    }
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'mini-btn';
    up.textContent = 'Your photo…';
    up.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadTarget = i;
      state.selected = i;
      buildSlotCards();
      syncZoom();
      fileInput.click();
    });
    actions.appendChild(up);
    body.appendChild(actions);
    card.appendChild(body);

    card.addEventListener('click', () => {
      state.selected = i;
      buildSlotCards();
      syncZoom();
    });
    slotsEl.appendChild(card);
  });
}

/* ---------------- controls ---------------- */

function segWire(id, attr, apply) {
  const el = document.getElementById(id);
  el.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      apply(b.dataset[attr]);
      render();
    });
  });
}

segWire('layoutSeg', 'layout', (v) => { state.layout = v; buildSlotCards(); });
segWire('sizeSeg', 'size', (v) => { state.size = v; });
segWire('gradeSeg', 'grade', (v) => { state.grade = v; });

const accentsEl = document.getElementById('accents');
for (const colour of ACCENTS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (colour === state.accent ? ' on' : '');
  b.style.background = colour;
  b.style.color = colour;
  b.title = colour;
  b.addEventListener('click', () => {
    state.accent = colour;
    accentsEl.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
  accentsEl.appendChild(b);
}

document.getElementById('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
document.getElementById('kickerInput').addEventListener('input', (e) => { state.kicker = e.target.value; render(); });
document.getElementById('sunToggle').addEventListener('change', (e) => { state.sun = e.target.checked; render(); });
document.getElementById('onePhoto').addEventListener('change', (e) => {
  state.onePhoto = e.target.checked;
  buildSlotCards();
  render();
});
document.getElementById('shuffleBtn').addEventListener('click', () => {
  for (const s of state.slots) {
    s.dx = Math.random() * 0.8 - 0.4;
    s.dy = Math.random() * 0.8 - 0.4;
    s.zoom = 1 + Math.random() * 0.5;
    clampCrop(s);
  }
  syncZoom();
  render();
});

const zoomEl = document.getElementById('zoom');
function syncZoom() {
  zoomEl.value = String(effSlot(state.selected).zoom);
}
zoomEl.addEventListener('input', () => {
  const slot = effSlot(state.selected);
  slot.zoom = parseFloat(zoomEl.value);
  clampCrop(slot);
  render();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  renderFull().toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-frame-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
});

/* ---------------- canvas drag & zoom ---------------- */

function panelBBox(poly, W, H) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { bx: x0 * W, by: y0 * H, bw: (x1 - x0) * W, bh: (y1 - y0) * H };
}

function pointerNorm(e) {
  const r = canvas.getBoundingClientRect();
  return { nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height, px: (e.clientX - r.left) * (canvas.width / r.width), py: (e.clientY - r.top) * (canvas.height / r.height) };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const { nx, ny } = pointerNorm(e);
  const panels = layoutPanels(state.layout, canvas.width / canvas.height);
  const idx = pickPanel(panels, nx, ny);
  if (idx < 0) return;
  state.selected = state.onePhoto ? 0 : idx;
  buildSlotCards();
  syncZoom();
  const slot = effSlot(idx);
  if (!slot.img) return;
  const box = panelBBox(panels[idx], canvas.width, canvas.height);
  const fit = fitFor(slot.img, box.bw, box.bh, slot.zoom);
  drag = { slot, startX: e.clientX, startY: e.clientY, dx0: slot.dx, dy0: slot.dy, slackX: fit.slackX, slackY: fit.slackY, rect: canvas.getBoundingClientRect() };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const scaleX = canvas.width / drag.rect.width;
  const scaleY = canvas.height / drag.rect.height;
  if (drag.slackX > 0) drag.slot.dx = drag.dx0 + ((e.clientX - drag.startX) * scaleX) / drag.slackX;
  if (drag.slackY > 0) drag.slot.dy = drag.dy0 + ((e.clientY - drag.startY) * scaleY) / drag.slackY;
  clampCrop(drag.slot);
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { nx, ny } = pointerNorm(e);
  const panels = layoutPanels(state.layout, canvas.width / canvas.height);
  const idx = pickPanel(panels, nx, ny);
  if (idx < 0) return;
  const slot = effSlot(idx);
  if (!slot.img) return;
  state.selected = state.onePhoto ? 0 : idx;
  slot.zoom *= Math.exp(-e.deltaY * 0.0012);
  clampCrop(slot);
  buildSlotCards();
  syncZoom();
  render();
}, { passive: false });

/* ---------------- shot mode ---------------- */

function applyShotParams() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (q.get('layout')) state.layout = q.get('layout');
  if (q.get('size')) state.size = q.get('size');
  if (q.get('grade')) state.grade = q.get('grade');
  if (q.get('accent')) state.accent = q.get('accent');
  if (q.get('title') !== null) state.title = q.get('title');
  if (q.get('subtitle') !== null) state.kicker = q.get('subtitle');
  if (q.get('sun') === '0') state.sun = false;
  if (q.get('one') === '1') state.onePhoto = true;
  const photos = q.get('photos');
  if (photos) {
    photos.split(',').forEach((name, i) => {
      if (i < state.slots.length && SAMPLE_URLS[name]) {
        state.slots[i].sample = name;
        state.slots[i].label = SAMPLE_LABELS[name];
        state.slots[i].thumb = null;
      }
    });
  }
  syncUIFromState();
}

function markSeg(id, attr, value) {
  document.getElementById(id).querySelectorAll('button').forEach((b) => {
    b.classList.toggle('on', b.dataset[attr] === value);
  });
}

function syncUIFromState() {
  markSeg('layoutSeg', 'layout', state.layout);
  markSeg('sizeSeg', 'size', state.size);
  markSeg('gradeSeg', 'grade', state.grade);
  document.getElementById('titleInput').value = state.title;
  document.getElementById('kickerInput').value = state.kicker;
  document.getElementById('sunToggle').checked = state.sun;
  document.getElementById('onePhoto').checked = state.onePhoto;
  accentsEl.querySelectorAll('.swatch').forEach((b) => {
    b.classList.toggle('on', b.style.background === state.accent || b.title === state.accent);
  });
}

/* ---------------- init ---------------- */

async function init() {
  applyShotParams();
  try {
    await Promise.race([
      document.fonts.load('100px Anton'),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (e) { /* fall back to the next font in the stack */ }
  for (const slot of state.slots) {
    if (slot.sample) slot.img = await sampleImage(slot.sample);
  }
  buildSlotCards();
  syncZoom();
  render();
  document.title = `READY · ${document.title}`;
}

init();
