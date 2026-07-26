// Generates the sample image the demo and playground render.
//
// Synthetic on purpose: the repo stays free of third-party photos, and the
// scene is built to exercise the renderer - a smooth sky for tonal ramps, a
// bright sun for the top of the glyph ramp, hard silhouettes for edge
// detection, and saturated water so colour grading has something to grade.
//
//   node scripts/make-sample.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTH = 900;
const HEIGHT = 506;
const HORIZON = Math.round(HEIGHT * 0.62);

const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const SUN = { x: WIDTH * 0.72, y: HORIZON - 74, r: 34 };

/** Rolling hills, as a height above the horizon at a given x. */
function ridge(x) {
  const t = x / WIDTH;
  return 44 * Math.sin(t * 5.2 + 0.7)
    + 26 * Math.sin(t * 11.3 + 2.1)
    + 12 * Math.sin(t * 23.7 + 4.4);
}

function pixel(x, y) {
  // sky: deep blue overhead warming towards the horizon
  const t = smoothstep(y / HORIZON);
  let r = mix(24, 214, t ** 1.6);
  let g = mix(58, 138, t ** 1.4);
  let b = mix(112, 96, t);

  // sun disc plus a soft halo
  const d = Math.hypot(x - SUN.x, y - SUN.y);
  if (d < SUN.r * 6) {
    const halo = Math.exp(-((d / (SUN.r * 2.4)) ** 2));
    r += 190 * halo;
    g += 140 * halo;
    b += 60 * halo;
  }
  if (d < SUN.r) {
    const edge = smoothstep((SUN.r - d) / 5);
    r = mix(r, 255, edge);
    g = mix(g, 246, edge);
    b = mix(b, 214, edge);
  }

  if (y > HORIZON) {
    // water: the sky colour flipped and cooled, with a specular column
    const depth = (y - HORIZON) / (HEIGHT - HORIZON);
    const mirror = smoothstep(1 - depth);
    r = mix(8, 46, mirror) + 40 * mirror;
    g = mix(46, 128, mirror);
    b = mix(74, 150, mirror);

    const glint = Math.exp(-(((x - SUN.x) / 60) ** 2))
      * Math.abs(Math.sin(y * 0.55 + Math.sin(x * 0.06) * 2))
      * (1 - depth * 0.75);
    r += 210 * glint;
    g += 180 * glint;
    b += 120 * glint;
  } else {
    // hills, dark against the sky, nearer ones darker
    const near = HORIZON - ridge(x);
    const far = HORIZON - ridge(x * 0.55 + 240) * 0.55 - 46;
    if (y > near) { r *= 0.16; g *= 0.2; b *= 0.26; }
    else if (y > far) { r *= 0.42; g *= 0.46; b *= 0.54; }
  }

  return [clamp(r), clamp(g), clamp(b)];
}

const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
let o = 0;
for (let y = 0; y < HEIGHT; y++) {
  raw[o++] = 0; // filter: none
  for (let x = 0; x < WIDTH; x++) {
    const [r, g, b] = pixel(x, y);
    raw[o++] = r; raw[o++] = g; raw[o++] = b;
  }
}

function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 2;   // colour type: truecolour
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const dir of ['demo', 'playground']) {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'sample.png'), png);
}

console.log(`wrote ${WIDTH}x${HEIGHT} sample.png (${png.length} bytes) to demo/ and playground/`);
