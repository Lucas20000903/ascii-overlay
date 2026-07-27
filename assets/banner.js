/**
 * Renders the readme banner, one frame at a time.
 *
 * Loaded into the demo page so it can import the built library and reach the
 * assets over http. `window.__banner.frame(n)` returns a data url.
 */
window.__bannerReady = (async () => {
  const lib = await import('/dist/index.js');

  const W = 1600, H = 694;
  const load = async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  };
  const [meadow, sun] = await Promise.all([
    load('/assets/src/meadow.webp'),
    load('/assets/src/sun.webp'),
  ]);

  const pixels = (draw, w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    draw(ctx, c);
    return ctx.getImageData(0, 0, w, h);
  };

  // --- the sun, as something the renderer can chew on -----------------------
  // The asset is a black silhouette on white - a ring of rays around a hollow
  // centre. Its ink covers about a seventh of the frame, so feeding those
  // pixels in as the source would leave most of the shape reading as
  // background. The ink decides where glyphs go; what they read is painted
  // separately, so the rays fill densely and the hole stays a hole.
  const SUN = 580;

  const silhouette = pixels((ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SUN, SUN);
    ctx.drawImage(sun, 0, 0, SUN, SUN);
  }, SUN, SUN);

  const isInk = (x, y) => silhouette.data[(y * SUN + x) * 4] < 128;

  const sunSource = (() => {
    const c = document.createElement('canvas');
    c.width = SUN; c.height = SUN;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const out = ctx.createImageData(SUN, SUN);
    const cx = SUN / 2, cy = SUN / 2;
    for (let y = 0; y < SUN; y++) {
      for (let x = 0; x < SUN; x++) {
        const i = y * SUN + x;
        let v = 0;
        if (isInk(x, y)) {
          // brighter towards the middle, never dark enough to fall off the ramp
          const r = Math.hypot(x - cx, y - cy) / (SUN * 0.62);
          const falloff = 1 - Math.min(1, r) * 0.38;
          const grain = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          v = Math.max(80, Math.min(255, 255 * falloff + grain * 60 - 30));
        }
        const p = i * 4;
        out.data[p] = v; out.data[p + 1] = v; out.data[p + 2] = v; out.data[p + 3] = 255;
      }
    }
    return out;
  })();

  const probe = document.createElement('canvas').getContext('2d');
  const FONT = 12;
  const cell = lib.measureCell(probe, FONT);
  const cols = Math.ceil(SUN / cell.cellWidth);
  const rows = Math.ceil(SUN / cell.cellHeight);

  /** A cell belongs to the sun when its centre lands on the silhouette. */
  const insideSun = (col, row) => {
    const x = Math.min(SUN - 1, Math.floor((col + 0.5) * cell.cellWidth));
    const y = Math.min(SUN - 1, Math.floor((row + 0.5) * cell.cellHeight));
    return isInk(x, y);
  };

  /** Squigglevision: a wobble held for a beat, applied to what each cell reads. */
  const wobble = (frame, amp) => (col, row) => {
    const h = Math.imul((col * 73856093) ^ (row * 19349663) ^ (frame * 83492791), 0x2545f491);
    return {
      x: ((h & 0xff) / 255 - 0.5) * 2 * amp,
      y: (((h >>> 8) & 0xff) / 255 - 0.5) * 2 * amp,
    };
  };

  const title = (ctx) => {
    const x = 96;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#14161a';
    ctx.font = '700 92px "Helvetica Neue", "Avenir Next", system-ui, sans-serif';
    ctx.fillText('ascii', x, 292);
    const w = ctx.measureText('ascii').width;
    ctx.fillStyle = '#1a44ff';
    ctx.fillText('-overlay', x + w, 292);

    ctx.fillStyle = '#14161a';
    ctx.font = '400 27px "Helvetica Neue", "Avenir Next", system-ui, sans-serif';
    ctx.fillText('Glyphs over pictures.', x, 352);

    ctx.fillStyle = 'rgba(20,22,26,0.72)';
    ctx.font = '400 19px "Helvetica Neue", "Avenir Next", system-ui, sans-serif';
    ctx.fillText('Characters, braille and dithered modes. Canvas and SVG.', x, 400);
    ctx.fillText('Layers, masks, live video. No runtime dependencies.', x, 428);

  };

  const frame = (n, { amp = 1.1 } = {}) => {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.drawImage(meadow, 0, 0, W, H);
    title(ctx);

    const grid = lib.renderAscii(sunSource, {
      mode: 'characters',
      ...cell,
      // the library's own ramp, so the banner shows what you get out of the box
      tone: { contrast: 1.1 },
      mask: insideSun,
      sampleOffset: wobble(n, amp),
    });

    const art = document.createElement('canvas');
    art.width = SUN; art.height = SUN;
    lib.paintLayers(art.getContext('2d'), [
      lib.asciiLayer(grid, { fontSize: FONT, ...cell, color: '#ffffff', opacity: 0.94 }),
    ]);

    ctx.drawImage(art, W - SUN - 110, 26);
    return out;
  };

  return { frame, cols, rows, W, H };
})();
