import {
  renderAscii, drawToCanvas, ellipseMask, measureCell, RAMPS,
} from '../dist/index.js';

const out = document.getElementById('out');
const panels = [];
window.__exports = {};

function show(label, canvas) {
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(cap, canvas);
  out.append(fig);
}

/**
 * Cell size that tiles without gaps.
 *
 * The height comes from the glyph's ink, not the font size - see the design
 * note in the README about why those differ.
 */
function cellFor(fontSize, solid = false) {
  const probe = document.createElement('canvas').getContext('2d');
  return measureCell(probe, fontSize, solid ? { sample: '\u2588' } : {});
}

const img = new Image();
img.src = './sample.png';
await img.decode();

const scratch = document.createElement('canvas');
scratch.width = img.naturalWidth;
scratch.height = img.naturalHeight;
const sctx = scratch.getContext('2d', { willReadFrequently: true });
sctx.drawImage(img, 0, 0);
const source = sctx.getImageData(0, 0, scratch.width, scratch.height);

const BLUR_BACKDROP = { blur: 12, opacity: 0.8 };
const OVAL = ellipseMask(source.width, source.height, {
  cx: source.width * 0.42,
  cy: source.height * 0.5,
  rx: source.width * 0.3,
  ry: source.height * 0.42,
});

const CASES = [
  // --- Characters ---
  { key: 'char-standard', section: 'Characters', label: 'ramp: standard',
    render: { mode: 'characters', ramp: 'standard' }, draw: { background: '#000' }, fontSize: 11 },
  { key: 'char-detailed', section: 'Characters', label: `ramp: detailed (${RAMPS.detailed.length} glyphs)`,
    render: { mode: 'characters', ramp: 'detailed' }, draw: { background: '#000' }, fontSize: 11 },
  { key: 'char-blocks', section: 'Characters', label: 'ramp: blocks',
    render: { mode: 'characters', ramp: 'blocks' }, draw: { background: '#000' }, fontSize: 11 },
  { key: 'char-invert', section: 'Characters', label: 'invert - dark ink on paper',
    render: { mode: 'characters', ramp: 'standard', invert: true },
    draw: { background: '#f4f1ea', color: '#1a1a1a' }, fontSize: 11 },
  { key: 'char-dodge', section: 'Characters', label: 'glyph blend: color-dodge over the blurred original',
    render: { mode: 'characters', ramp: 'standard' },
    draw: { background: '#000', backdrop: BLUR_BACKDROP, blend: 'color-dodge' }, fontSize: 11 },

  // --- Intensity ---
  { key: 'int-contrast', section: 'Intensity', label: 'tone: contrast 2.2, gamma 0.8',
    render: { mode: 'characters', tone: { contrast: 2.2, gamma: 0.8 } },
    draw: { background: '#000' }, fontSize: 11 },
  { key: 'int-edges', section: 'Intensity', label: 'edgeEmphasis 0.85 - glyphs follow contours',
    render: { mode: 'characters', edgeEmphasis: 0.85, tone: { contrast: 1.4 } },
    draw: { background: '#000' }, fontSize: 9 },
  { key: 'int-coverage', section: 'Intensity', label: 'coverage 0.35 - scattered thinning over the blurred original',
    render: { mode: 'characters', coverage: 0.35 },
    draw: { background: '#000', backdrop: BLUR_BACKDROP }, fontSize: 11 },
  { key: 'int-dark', section: 'Intensity', label: 'darkThreshold 0.45 - shadows left to the backdrop',
    render: { mode: 'characters', darkThreshold: 0.45 },
    draw: { background: '#000', backdrop: BLUR_BACKDROP }, fontSize: 11 },

  // --- Colour ---
  { key: 'col-sepia', section: 'Colour', label: 'grade: sepia preset',
    render: { mode: 'characters', grade: { preset: 'sepia' } },
    draw: { background: '#0d0a06' }, fontSize: 11 },
  { key: 'col-cyber', section: 'Colour', label: 'grade: cyber preset, saturation 1.4',
    render: { mode: 'characters', grade: { preset: 'cyber', saturation: 1.4 } },
    draw: { background: '#00060a' }, fontSize: 11 },
  { key: 'col-tint', section: 'Colour', label: 'grade: amber tint, soft-light blend',
    render: { mode: 'characters',
      grade: { tint: { color: { r: 255, g: 170, b: 60 }, blend: 'soft-light', opacity: 0.85 } } },
    draw: { background: '#0a0705' }, fontSize: 11 },

  // --- Mask ---
  { key: 'mask-oval', section: 'Mask', label: 'ellipse mask - ASCII inside, blurred original outside',
    render: { mode: 'characters', mask: OVAL },
    draw: { background: '#000', backdrop: BLUR_BACKDROP }, fontSize: 11 },
  { key: 'mask-braille', section: 'Mask', label: 'ellipse mask, braille over the sharp original',
    render: { mode: 'braille', mask: OVAL, threshold: 0.42 },
    draw: { background: '#000', color: '#ffffff', backdrop: { blur: 0, opacity: 0.5 } }, fontSize: 9 },

  // --- Animation ---
  { key: 'anim-t0', section: 'Animation', label: 'shimmer 2.5 at t = 0.00',
    render: { mode: 'characters', animation: { time: 0, shimmer: 2.5 } },
    draw: { background: '#000' }, fontSize: 11 },
  { key: 'anim-t1', section: 'Animation', label: 'shimmer 2.5 at t = 0.50 - same seed, different frame',
    render: { mode: 'characters', animation: { time: 0.5, shimmer: 2.5 } },
    draw: { background: '#000' }, fontSize: 11 },

  // --- Dither ---
  { key: 'dither', section: 'Dither', label: 'Floyd-Steinberg blocks',
    render: { mode: 'dither' }, draw: { background: '#000', color: '#e8e8e8' }, fontSize: 5 },
];

function renderCase(c) {
  const fontSize = c.fontSize;
  const solid = c.render.mode === 'dither' || c.render.ramp === 'blocks';
  const grid = renderAscii(source, { ...cellFor(fontSize, solid), ...c.render });

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const backdrop = c.draw.backdrop ? { image: img, ...c.draw.backdrop } : undefined;
  drawToCanvas(canvas.getContext('2d'), grid, { fontSize, ...c.draw, backdrop });
  return { canvas, grid };
}

for (const c of CASES) {
  const { canvas, grid } = renderCase(c);
  const label = `${c.section}  |  ${c.label}  -  ${grid.cols}x${grid.rows} cells`;
  show(label, canvas);
  window.__exports[c.key] = canvas;
  panels.push({ label, canvas });
}

const original = document.createElement('canvas');
original.width = source.width;
original.height = source.height;
original.getContext('2d').drawImage(img, 0, 0);
show('original', original);
window.__exports.original = original;

// A live animated canvas, to confirm the shimmer actually moves.
const live = document.createElement('canvas');
live.width = source.width;
live.height = source.height;
show('Animation  |  live shimmer (requestAnimationFrame)', live);
{
  const fontSize = 11;
  const cell = cellFor(fontSize);
  const ctx = live.getContext('2d');
  const start = performance.now();
  const frame = now => {
    const time = (now - start) / 1000;
    const grid = renderAscii(source, {
      mode: 'characters', ...cell,
      animation: { time, shimmer: 2.5, speed: 0.6 },
    });
    drawToCanvas(ctx, grid, { fontSize, background: '#000' });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Contact sheet, panels scaled down so the whole set fits one image.
const SCALE = 0.55;
const PW = Math.round(source.width * SCALE);
const PH = Math.round(source.height * SCALE);
const CAP = 22;
const sheet = document.createElement('canvas');
sheet.width = PW;
sheet.height = (PH + CAP) * (panels.length + 1);
const shx = sheet.getContext('2d');
shx.fillStyle = '#111';
shx.fillRect(0, 0, sheet.width, sheet.height);

[{ label: 'original', canvas: original }, ...panels].forEach(({ label, canvas }, i) => {
  const y = i * (PH + CAP);
  shx.fillStyle = '#e8e8e8';
  shx.font = '13px system-ui, sans-serif';
  shx.textBaseline = 'middle';
  shx.fillText(label, 8, y + CAP / 2);
  shx.drawImage(canvas, 0, y + CAP, PW, PH);
});
show('contact sheet', sheet);
window.__exports.sheet = sheet;

window.__ready = true;
