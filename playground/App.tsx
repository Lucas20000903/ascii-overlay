import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  RAMPS, asciiLayer, ellipseMask, fillLayer, gridToText, imageLayer, imageMask,
  layersToSvg, measureCell, paintLayers, rectMask,
} from '../dist/index.js';
import { useAnimationTime, useAsciiGrid, useVideoSource } from '../dist/react/index.js';
import type { ImageLayerOptions, Layer } from '../dist/index.js';
import type {
  AsciiMode, BlendMode, GlyphBlend, Mask, Source, TintPreset,
} from '../dist/index.js';

/* ---------- small control primitives ---------- */

function Slider(props: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      <span className="row"><span>{props.label}</span><span>{props.value}</span></span>
      <input
        type="range" min={props.min} max={props.max} step={props.step ?? 0.01}
        value={props.value}
        onChange={e => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Select<T extends string>(props: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  return (
    <label>
      <span className="row"><span>{props.label}</span></span>
      <select value={props.value} onChange={e => props.onChange(e.target.value as T)}>
        {props.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Check(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.value}
        onChange={e => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

/* ---------- image loading ---------- */

interface Loaded { image: HTMLImageElement; data: ImageData }

function toImageData(image: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Load a URL, downscaling so very large photos stay interactive. */
async function loadImage(url: string, maxWidth = 1000): Promise<Loaded> {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (image.naturalWidth <= maxWidth) return { image, data: toImageData(image) };

  const scale = maxWidth / image.naturalWidth;
  const c = document.createElement('canvas');
  c.width = maxWidth;
  c.height = Math.round(image.naturalHeight * scale);
  c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
  const scaled = new Image();
  scaled.src = c.toDataURL('image/png');
  await scaled.decode();
  return { image: scaled, data: toImageData(scaled) };
}

type CellBasis = 'M' | 'ramp mean';

/**
 * Cell size that tiles without gaps.
 *
 * Solid ramps measure against a full block. Character ramps measure either `M`
 * (a middling glyph, legible) or the ramp's mean ink (denser, no banding, but
 * the heavy glyphs overlap into a lattice).
 */
function cellFor(
  fontSize: number,
  opts: { solid: boolean; basis: CellBasis; ramp: string; lineHeight: number;
          fontFamily: string },
) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const { lineHeight, fontFamily } = opts;
  if (opts.solid) {
    return measureCell(ctx, fontSize, { sample: '\u2588', lineHeight, fontFamily });
  }
  return opts.basis === 'ramp mean'
    ? measureCell(ctx, fontSize, { ramp: opts.ramp, lineHeight, fontFamily })
    : measureCell(ctx, fontSize, { lineHeight, fontFamily });
}

type MaskKind = 'none' | 'ellipse' | 'rect' | 'image';
type BackdropKind = 'none' | 'solid' | 'original' | 'blurred';
type MaskFrom = 'alpha' | 'luminance';

const MODES: readonly AsciiMode[] = ['characters', 'braille', 'dither'];
const RAMP_NAMES = Object.keys(RAMPS) as (keyof typeof RAMPS)[];
const PRESETS: readonly TintPreset[] =
  ['none', 'bw', 'sepia', 'warm', 'cool', 'vintage', 'fade', 'cyber'];
const TINT_BLENDS: readonly BlendMode[] = ['multiply', 'screen', 'overlay', 'soft-light'];
const GLYPH_BLENDS: readonly GlyphBlend[] =
  ['normal', 'screen', 'overlay', 'color-dodge', 'lighter'];
const MASK_KINDS: readonly MaskKind[] = ['none', 'ellipse', 'rect', 'image'];
const BACKDROPS: readonly BackdropKind[] = ['none', 'solid', 'original', 'blurred'];
const MASK_FROMS: readonly MaskFrom[] = ['alpha', 'luminance'];
const CELL_BASES: readonly CellBasis[] = ['M', 'ramp mean'];

type CellBg = 'none' | 'flat' | 'cell colour';
const CELL_BGS: readonly CellBg[] = ['none', 'flat', 'cell colour'];

const FONTS: readonly string[] = [
  'monospace', 'ui-monospace', 'Menlo', 'Monaco', 'Courier New',
  'serif', 'Georgia',
];

type SquiggleMode = 'image' | 'glyph';
const SQUIGGLE_MODES: readonly SquiggleMode[] = ['image', 'glyph'];

/** Stable-per-frame wobble for one cell. */
function wobble(col: number, row: number, frame: number, amp: number) {
  const h = Math.imul((col * 73856093) ^ (row * 19349663) ^ (frame * 83492791), 0x2545f491);
  return {
    x: ((h & 0xff) / 255 - 0.5) * 2 * amp,
    y: (((h >>> 8) & 0xff) / 255 - 0.5) * 2 * amp,
  };
}

/**
 * Squigglevision, written here rather than in the library: it is one use of two
 * generic hooks, not something the renderer should know about.
 *
 * `image` shakes what each cell reads, so the picture wobbles underneath and
 * the glyphs change to follow. `glyph` shakes where the glyph is drawn, leaving
 * the choice of glyph alone. They look quite different.
 */
const squiggleSample = (frame: number, amp: number) =>
  (col: number, row: number) => wobble(col, row, frame, amp);
const squiggleGlyph = (frame: number, amp: number) =>
  (c: Cell) => wobble(c.col, c.row, frame, amp);

/** Whether a face advances every glyph the same, which the grid relies on. */
function isMonospaced(family: string, size: number): boolean {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${size}px ${family}`;
  return Math.abs(ctx.measureText('M').width - ctx.measureText('i').width) < 0.05;
}

type Output = 'canvas' | 'svg';
const OUTPUTS: readonly Output[] = ['canvas', 'svg'];

const DEFS =
  '<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">'
  + '<feGaussianBlur stdDeviation="2" result="b"/>'
  + '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/>'
  + '<feMergeNode in="SourceGraphic"/></feMerge></filter>';

/**
 * Paints a layer stack with whichever backend is selected.
 *
 * The playground drives the core compositor directly rather than a React
 * wrapper, so the public API gets exercised the way a consumer would use it.
 */
function LayerStack(props: {
  layers: Layer[]; width: number; height: number;
  backend: Output; style?: CSSProperties;
}) {
  const { layers, width, height, backend, style } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  useEffect(() => {
    if (backend !== 'canvas') return;
    const ctx = ref.current?.getContext('2d');
    if (ctx) paintLayers(ctx, layers, { pixelRatio: ratio });
  }, [layers, backend, ratio, width, height]);

  if (backend === 'svg') {
    return (
      <div
        style={style}
        dangerouslySetInnerHTML={{ __html: layersToSvg(layers, { width, height, defs: DEFS }) }}
      />
    );
  }
  return (
    <canvas
      ref={ref}
      width={Math.round(width * ratio)}
      height={Math.round(height * ratio)}
      style={{ width, height, ...style }}
    />
  );
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [live, setLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [maskImage, setMaskImage] = useState<Source | null>(null);
  const [over, setOver] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  // Characters
  const [mode, setMode] = useState<AsciiMode>('characters');
  const [fontSize, setFontSize] = useState(11);
  const [rampName, setRampName] = useState<keyof typeof RAMPS>('standard');
  const [customRamp, setCustomRamp] = useState('');
  const [invert, setInvert] = useState(false);
  const [glyphBlend, setGlyphBlend] = useState<GlyphBlend>('normal');
  const [glyphColor, setGlyphColor] = useState('');
  const [cellBasis, setCellBasis] = useState<CellBasis>('M');
  const [fontFamily, setFontFamily] = useState('monospace');
  const [customFont, setCustomFont] = useState('');
  const [lineHeight, setLineHeight] = useState(1);
  const [threshold, setThreshold] = useState(0.45);

  // Intensity
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [edgeEmphasis, setEdgeEmphasis] = useState(0);
  const [darkThreshold, setDarkThreshold] = useState(0);
  const [coverage, setCoverage] = useState(1);

  // Colour
  const [preset, setPreset] = useState<TintPreset>('none');
  const [saturation, setSaturation] = useState(1);
  const [tintOn, setTintOn] = useState(false);
  const [tintColor, setTintColor] = useState('#ffaa3c');
  const [tintBlend, setTintBlend] = useState<BlendMode>('soft-light');
  const [tintOpacity, setTintOpacity] = useState(0.8);

  // Mask
  const [maskKind, setMaskKind] = useState<MaskKind>('none');
  const [maskFrom, setMaskFrom] = useState<MaskFrom>('luminance');
  const [maskInvert, setMaskInvert] = useState(false);
  const [maskSize, setMaskSize] = useState(0.6);

  // Backdrop
  const [backdropKind, setBackdropKind] = useState<BackdropKind>('none');
  const [blur, setBlur] = useState(12);
  const [backdropOpacity, setBackdropOpacity] = useState(0.85);

  // Animation
  const [squiggleAmp, setSquiggleAmp] = useState(0);
  const [squiggleMode, setSquiggleMode] = useState<SquiggleMode>('image');
  const [squiggleFps, setSquiggleFps] = useState(8);
  const [shimmer, setShimmer] = useState(0);
  const [speed, setSpeed] = useState(0.6);
  const [playing, setPlaying] = useState(true);

  // Layers
  const [transparent, setTransparent] = useState(false);
  const [bgColor, setBgColor] = useState('#05070c');
  const [cellBg, setCellBg] = useState<CellBg>('none');
  const [cellBgColor, setCellBgColor] = useState('#101820');
  const [fillBlanks, setFillBlanks] = useState(true);
  const [underOn, setUnderOn] = useState(false);
  const [underColor, setUnderColor] = useState('#1d3b57');
  const [underOpacity, setUnderOpacity] = useState(0.8);
  const [glow, setGlow] = useState(false);
  const [layerOpacity, setLayerOpacity] = useState(1);

  // Output
  const [output, setOutput] = useState<Output>('canvas');
  const [zoom, setZoom] = useState(1);

  useEffect(() => { void loadImage('/sample.png').then(setLoaded); }, []);

  // Paste an image straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.items ?? [])]
        .find(i => i.type.startsWith('image/'))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      void loadImage(URL.createObjectURL(file)).then(setLoaded);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const time = useAnimationTime({
    playing: playing && (shimmer > 0 || squiggleAmp > 0), speed,
  });
  // squigglevision holds each wobble for a beat instead of changing every frame
  const squiggleFrame = Math.floor(time * squiggleFps);

  const frame = useVideoSource(videoRef, { playing: live, maxWidth: 900 });
  const source = live ? frame : (loaded?.data ?? null);
  // imageLayer takes any CanvasImageSource, so the backdrop can be the live feed
  const backdropImage = live ? videoRef.current : loaded?.image ?? null;

  const mask = useMemo<Mask | undefined>(() => {
    if (!source || maskKind === 'none') return undefined;
    const { width: w, height: h } = source;
    if (maskKind === 'ellipse') {
      return ellipseMask(w, h, {
        cx: w / 2, cy: h / 2, rx: (w / 2) * maskSize, ry: (h / 2) * maskSize,
      });
    }
    if (maskKind === 'rect') {
      return rectMask(w, h, {
        x: (w * (1 - maskSize)) / 2, y: (h * (1 - maskSize)) / 2,
        width: w * maskSize, height: h * maskSize,
      });
    }
    return maskImage ? imageMask(maskImage, { from: maskFrom, invert: maskInvert }) : undefined;
  }, [source, maskKind, maskSize, maskImage, maskFrom, maskInvert]);

  const hex = (v: string) => ({
    r: parseInt(v.slice(1, 3), 16),
    g: parseInt(v.slice(3, 5), 16),
    b: parseInt(v.slice(5, 7), 16),
  });

  const activeRamp = customRamp.length > 0 ? customRamp : RAMPS[rampName];
  const solidRamp = mode === 'dither' || (customRamp.length === 0 && rampName === 'blocks');
  const activeFont = customFont.trim() || fontFamily;
  const cell = cellFor(fontSize, {
    solid: solidRamp, basis: cellBasis, ramp: activeRamp, lineHeight,
    fontFamily: activeFont,
  });
  const monospaced = isMonospaced(activeFont, fontSize);

  const render = useMemo(() => ({
    mode,
    cellWidth: cell.cellWidth,
    cellHeight: cell.cellHeight,
    ramp: customRamp.length > 0 ? customRamp : rampName,
    sampleOffset: squiggleAmp > 0 && squiggleMode === 'image'
      ? squiggleSample(squiggleFrame, squiggleAmp) : undefined,
    invert,
    threshold,
    tone: { contrast, brightness, gamma },
    edgeEmphasis,
    darkThreshold,
    coverage,
    grade: {
      preset,
      saturation,
      tint: tintOn
        ? { color: hex(tintColor), blend: tintBlend, opacity: tintOpacity }
        : undefined,
    },
    mask,
    animation: { time, shimmer },
  }), [mode, cell.cellWidth, cell.cellHeight, customRamp, rampName, invert, threshold,
       squiggleAmp, squiggleMode, squiggleFrame, contrast, brightness,
       gamma, edgeEmphasis, darkThreshold, coverage, preset, saturation, tintOn,
       tintColor, tintBlend, tintOpacity, mask, time, shimmer]);

  const backdrop = useMemo<ImageLayerOptions | undefined>(() => {
    if (backdropKind === 'none' || backdropKind === 'solid') return undefined;
    return {
      blur: backdropKind === 'blurred' ? blur : 0,
      opacity: backdropOpacity,
    };
  }, [backdropKind, blur, backdropOpacity]);

  const grid = useAsciiGrid(source ?? { width: 0, height: 0, data: new Uint8ClampedArray() },
    render);

  const underCell = cellFor(5, { solid: true, basis: cellBasis, ramp: activeRamp, lineHeight });
  const underGrid = useAsciiGrid(
    source ?? { width: 0, height: 0, data: new Uint8ClampedArray() },
    { mode: 'dither', ...underCell });

  const layers = useMemo<Layer[]>(() => {
    const stack: Layer[] = transparent ? [] : [fillLayer(bgColor)];
    if (backdropImage && backdrop) stack.push(imageLayer(backdropImage, backdrop));
    if (underOn) {
      stack.push(asciiLayer(underGrid, {
        fontSize: 5, ...underCell, color: underColor, opacity: underOpacity,
      }));
    }
    stack.push(asciiLayer(grid, {
      fontSize,
      cellWidth: cell.cellWidth,
      cellHeight: cell.cellHeight,
      cellBackground: cellBg === 'none' ? undefined
        : cellBg === 'flat' ? cellBgColor
        : c => `rgb(${c.color.r},${c.color.g},${c.color.b})`,
      fillBlankCells: fillBlanks,
      color: glyphColor || undefined,
      fontFamily: activeFont,
      offset: squiggleAmp > 0 && squiggleMode === 'glyph'
        ? squiggleGlyph(squiggleFrame, squiggleAmp) : undefined,
      blend: glyphBlend,
      opacity: layerOpacity,
      filter: glow ? 'url(#glow)' : undefined,
    }));
    return stack;
  }, [transparent, bgColor, cellBg, cellBgColor, fillBlanks, backdropImage, backdrop, underOn,
      underGrid, underCell, underColor, underOpacity, grid, fontSize,
      cell.cellWidth, cell.cellHeight, glyphColor, activeFont, squiggleAmp,
      squiggleMode, squiggleFrame, glyphBlend, layerOpacity, glow]);

  /** Play a stream or file url through the hidden <video> and sample it. */
  async function startVideo(attach: (el: HTMLVideoElement) => void) {
    setLive(true);
    // the element only mounts once `live` is true, so wait a frame for the ref
    await new Promise(r => requestAnimationFrame(r));
    const el = videoRef.current;
    if (!el) return;
    attach(el);
    el.muted = true;
    el.loop = true;
    await el.play().catch(() => {});
  }

  function pickVideo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void startVideo(el => { el.src = URL.createObjectURL(file); });
    };
    input.click();
  }

  async function useWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await startVideo(el => { el.srcObject = stream; });
    } catch {
      setLive(false);
    }
  }

  function stopVideo() {
    const el = videoRef.current;
    const stream = el?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    setLive(false);
  }

  async function pick(setter: (l: Loaded) => void) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) setter(await loadImage(URL.createObjectURL(file)));
    };
    input.click();
  }

  function save(href: string, name: string) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
  }

  function download() {
    if (output === 'svg') {
      const svg = layersToSvg(layers,
        { width: source!.width, height: source!.height, defs: DEFS });
      save(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
        `ascii-${mode}.svg`);
      return;
    }
    const canvas = stage.current?.querySelector('canvas');
    if (canvas) save(canvas.toDataURL('image/png'), `ascii-${mode}.png`);
  }

  // At zoom 1 the output sits at its natural size; above that it is deliberately
  // blown up so the canvas and svg renderers can be compared.
  const scaled: CSSProperties = zoom === 1
    ? { maxWidth: '100%', height: 'auto' }
    : { width: (source?.width ?? 0) * zoom, height: 'auto', maxWidth: 'none' };

  return (
    <>
      <div className="panel">
        <h1>ascii-react playground</h1>

        <h2>Source</h2>
        <div
          className={over ? 'drop over' : 'drop'}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={async e => {
            e.preventDefault();
            setOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) setLoaded(await loadImage(URL.createObjectURL(file)));
          }}
        >
          Drop an image here, or paste with cmd+V
          <div style={{ marginTop: 6 }} className="actions">
            <button onClick={() => void pick(setLoaded)}>Image</button>
            <button onClick={pickVideo}>Video</button>
            <button onClick={() => void useWebcam()}>Webcam</button>
            {live && <button onClick={stopVideo}>Stop</button>}
          </div>
        </div>
        {live && <div className="meta">live - {source ? `${source.width}×${source.height}` : 'waiting'}</div>}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: live ? 'block' : 'none', width: '100%', marginTop: 8, borderRadius: 5 }}
        />

        <h2>Characters</h2>
        <Select label="mode" value={mode} options={MODES} onChange={setMode} />
        <Slider label="fontSize" value={fontSize} min={3} max={28} step={1}
          onChange={setFontSize} />
        <Select label="ramp" value={rampName} options={RAMP_NAMES} onChange={setRampName} />
        <label>
          <span className="row"><span>custom ramp</span><span>dark to bright</span></span>
          <input type="text" value={customRamp} placeholder="empty uses the preset above"
            onChange={e => setCustomRamp(e.target.value)} />
        </label>
        <Check label="invert" value={invert} onChange={setInvert} />
        <Select label="glyph blend" value={glyphBlend} options={GLYPH_BLENDS}
          onChange={setGlyphBlend} />
        <Select label="font" value={fontFamily} options={FONTS} onChange={setFontFamily} />
        <label>
          <span className="row">
            <span>custom font</span>
            <span>{monospaced ? 'monospaced' : 'proportional, falls back to per-glyph'}</span>
          </span>
          <input type="text" value={customFont} placeholder="empty uses the list above"
            onChange={e => setCustomFont(e.target.value)} />
        </label>
        <Select label="cell height from" value={cellBasis} options={CELL_BASES}
          onChange={setCellBasis} />
        <Slider label="lineHeight" value={lineHeight} min={0.5} max={1.6}
          onChange={setLineHeight} />
        {mode !== 'characters' && (
          <Slider label="threshold" value={threshold} min={0} max={1} onChange={setThreshold} />
        )}

        <h2>Intensity</h2>
        <Slider label="contrast" value={contrast} min={0} max={4} onChange={setContrast} />
        <Slider label="brightness" value={brightness} min={-1} max={1} onChange={setBrightness} />
        <Slider label="gamma" value={gamma} min={0.2} max={3} onChange={setGamma} />
        <Slider label="edgeEmphasis" value={edgeEmphasis} min={0} max={1}
          onChange={setEdgeEmphasis} />
        <Slider label="darkThreshold" value={darkThreshold} min={0} max={1}
          onChange={setDarkThreshold} />
        <Slider label="coverage" value={coverage} min={0} max={1} onChange={setCoverage} />

        <h2>Colour</h2>
        <Select label="preset" value={preset} options={PRESETS} onChange={setPreset} />
        <Slider label="saturation" value={saturation} min={0} max={3} onChange={setSaturation} />
        <Check label="tint" value={tintOn} onChange={setTintOn} />
        {tintOn && (
          <>
            <input type="color" value={tintColor}
              onChange={e => setTintColor(e.target.value)} />
            <Select label="tint blend" value={tintBlend} options={TINT_BLENDS}
              onChange={setTintBlend} />
            <Slider label="tint opacity" value={tintOpacity} min={0} max={1}
              onChange={setTintOpacity} />
          </>
        )}

        <h2>Mask</h2>
        <Select label="shape" value={maskKind} options={MASK_KINDS} onChange={setMaskKind} />
        {(maskKind === 'ellipse' || maskKind === 'rect') && (
          <Slider label="size" value={maskSize} min={0.1} max={1} onChange={setMaskSize} />
        )}
        {maskKind === 'image' && (
          <>
            <button onClick={() => void pick(l => setMaskImage(l.data))}>
              Choose a matte
            </button>
            <div style={{ height: 8 }} />
            <Select label="from" value={maskFrom} options={MASK_FROMS}
              onChange={setMaskFrom} />
            <Check label="invert mask" value={maskInvert} onChange={setMaskInvert} />
            {!maskImage && <div className="meta">no matte loaded yet</div>}
          </>
        )}

        <h2>Backdrop</h2>
        <Select label="kind" value={backdropKind} options={BACKDROPS}
          onChange={setBackdropKind} />
        {backdropKind === 'blurred' && (
          <Slider label="blur" value={blur} min={0} max={40} step={1} onChange={setBlur} />
        )}
        {(backdropKind === 'blurred' || backdropKind === 'original') && (
          <Slider label="opacity" value={backdropOpacity} min={0} max={1}
            onChange={setBackdropOpacity} />
        )}

        <h2>Layers</h2>
        <Check label="transparent background" value={transparent} onChange={setTransparent} />
        {!transparent && (
          <label>
            <span className="row"><span>background</span></span>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
          </label>
        )}
        <Select label="cell background" value={cellBg} options={CELL_BGS}
          onChange={setCellBg} />
        {cellBg === 'flat' && (
          <input type="color" value={cellBgColor}
            onChange={e => setCellBgColor(e.target.value)} />
        )}
        {cellBg !== 'none' && (
          <Check label="fill blank cells" value={fillBlanks} onChange={setFillBlanks} />
        )}
        <Check label="dither under-layer" value={underOn} onChange={setUnderOn} />
        {underOn && (
          <>
            <input type="color" value={underColor}
              onChange={e => setUnderColor(e.target.value)} />
            <Slider label="under opacity" value={underOpacity} min={0} max={1}
              onChange={setUnderOpacity} />
          </>
        )}
        <Slider label="ascii opacity" value={layerOpacity} min={0} max={1}
          onChange={setLayerOpacity} />
        <label>
          <span className="row"><span>ascii flat colour</span><span>empty uses the cell colour</span></span>
          <input type="text" value={glyphColor} placeholder="#ffffff"
            onChange={e => setGlyphColor(e.target.value)} />
        </label>
        <Check label="glow filter (svg only)" value={glow} onChange={setGlow} />

        <h2>Output</h2>
        <Select label="renderer" value={output} options={OUTPUTS} onChange={setOutput} />
        <Slider label="zoom" value={zoom} min={1} max={6} step={0.5} onChange={setZoom} />
        <div className="meta">
          {output === 'svg'
            ? 'vector, sharp at any zoom'
            : 'raster, blurs when scaled up'}
        </div>

        <h2>Animation</h2>
        <Slider label="squiggle" value={squiggleAmp} min={0} max={4} step={0.1}
          onChange={setSquiggleAmp} />
        {squiggleAmp > 0 && (
          <>
            <Select label="squiggle target" value={squiggleMode}
              options={SQUIGGLE_MODES} onChange={setSquiggleMode} />
            <Slider label="squiggle fps" value={squiggleFps} min={1} max={24} step={1}
              onChange={setSquiggleFps} />
          </>
        )}
        <Slider label="shimmer" value={shimmer} min={0} max={6} step={0.1}
          onChange={setShimmer} />
        <Slider label="speed" value={speed} min={0} max={3} onChange={setSpeed} />
        <Check label="playing" value={playing} onChange={setPlaying} />
      </div>

      <div className="stage" ref={stage}>
        {source ? (
          <>
            <div className="actions">
              <button onClick={download}>
                {output === 'svg' ? 'Save SVG' : 'Save PNG'}
              </button>
              <button onClick={() => void navigator.clipboard.writeText(gridToText(grid))}>
                Copy text
              </button>
              <span className="meta">
                {grid.cols}×{grid.rows} cells · cell {cell.cellWidth.toFixed(1)}×
                {cell.cellHeight.toFixed(1)}px · {source.width}×{source.height}px
                {shimmer > 0 && ` · t=${time.toFixed(2)}`}
              </span>
            </div>

            <div className={transparent ? 'checker' : undefined}>
            <LayerStack
              layers={layers}
              width={source.width}
              height={source.height}
              backend={output}
              style={scaled}
            />
            </div>

            {mode !== 'dither' && (
              <details>
                <summary className="meta">Show as text</summary>
                <pre>{gridToText(grid)}</pre>
              </details>
            )}
          </>
        ) : (
          <div className="meta">loading image...</div>
        )}
      </div>
    </>
  );
}
