/**
 * Renders the readme's video strip, one frame at a time.
 *
 * The clip is a sunflower swaying against black. Each frame goes through the
 * renderer exactly as a live feed would - the only difference is that the
 * frames arrive as files here, so the output is reproducible.
 */
window.__videoReady = (async () => {
  const lib = await import('/dist/index.js');

  const COUNT = 24;
  const W = 720, H = 405;

  const frames = await Promise.all(
    Array.from({ length: COUNT }, async (_, i) => {
      const img = new Image();
      img.src = `/assets/src/video/f${String(i + 1).padStart(3, '0')}.webp`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      return { img, pixels: ctx.getImageData(0, 0, W, H) };
    }),
  );

  const probe = document.createElement('canvas').getContext('2d');
  const FONT = 11;
  const cell = lib.measureCell(probe, FONT);

  const SPLIT = W / 2;

  const frame = (n) => {
    const { img, pixels } = frames[n % COUNT];

    const grid = lib.renderAscii(pixels, {
      mode: 'characters',
      ...cell,
      tone: { contrast: 1.35, brightness: 0.04 },
      // the clip is mostly black; without this the empty half fills with dots
      darkThreshold: 0.12,
      // glyphs on the left, the untouched frame on the right
      mask: (col) => col * cell.cellWidth < SPLIT,
    });

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#0b0c0f';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(SPLIT, 0, W - SPLIT, H);
    ctx.clip();
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();

    lib.paintLayers(ctx, [lib.asciiLayer(grid, { fontSize: FONT, ...cell })],
      { clear: false });

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(SPLIT, 0, 1, H);
    return out;
  };

  return { frame, count: COUNT, cols: Math.ceil(W / cell.cellWidth), W, H };
})();
