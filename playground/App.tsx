import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  RAMPS, ellipseMask, gridToSvg, gridToText, imageMask, measureCell, rectMask,
} from '../dist/index.js';
import {
  AsciiCanvas, AsciiSvg, useAnimationTime, useAsciiGrid,
} from '../dist/react/index.js';
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
  opts: { solid: boolean; basis: CellBasis; ramp: string; lineHeight: number },
) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const { lineHeight } = opts;
  if (opts.solid) return measureCell(ctx, fontSize, { sample: '\u2588', lineHeight });
  return opts.basis === 'ramp mean'
    ? measureCell(ctx, fontSize, { ramp: opts.ramp, lineHeight })
    : measureCell(ctx, fontSize, { lineHeight });
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

type Output = 'canvas' | 'svg';
const OUTPUTS: readonly Output[] = ['canvas', 'svg'];

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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
  const [cellBasis, setCellBasis] = useState<CellBasis>('M');
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
  const [shimmer, setShimmer] = useState(0);
  const [speed, setSpeed] = useState(0.6);
  const [playing, setPlaying] = useState(true);

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

  const time = useAnimationTime({ playing: playing && shimmer > 0, speed });

  const source = loaded?.data ?? null;

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
  const cell = cellFor(fontSize,
    { solid: solidRamp, basis: cellBasis, ramp: activeRamp, lineHeight });

  const render = useMemo(() => ({
    mode,
    cellWidth: cell.cellWidth,
    cellHeight: cell.cellHeight,
    ramp: customRamp.length > 0 ? customRamp : rampName,
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
  }), [mode, cell.cellWidth, cell.cellHeight, customRamp, rampName, invert, threshold, contrast, brightness,
       gamma, edgeEmphasis, darkThreshold, coverage, preset, saturation, tintOn,
       tintColor, tintBlend, tintOpacity, mask, time, shimmer]);

  const backdrop = useMemo(() => {
    if (!loaded || backdropKind === 'none' || backdropKind === 'solid') return undefined;
    return {
      image: loaded.image,
      blur: backdropKind === 'blurred' ? blur : 0,
      opacity: backdropOpacity,
    };
  }, [loaded, backdropKind, blur, backdropOpacity]);

  // Only for the stats readout and the text export; AsciiCanvas renders its own.
  const grid = useAsciiGrid(source ?? { width: 0, height: 0, data: new Uint8ClampedArray() },
    render);

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
      const svg = gridToSvg(grid, {
        fontSize, cellWidth: cell.cellWidth, cellHeight: cell.cellHeight,
        background: backdropKind === 'none' ? undefined : '#000',
      });
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
          <div style={{ marginTop: 6 }}>
            <button onClick={() => void pick(setLoaded)}>Choose a file</button>
          </div>
        </div>

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

        <h2>Output</h2>
        <Select label="renderer" value={output} options={OUTPUTS} onChange={setOutput} />
        <Slider label="zoom" value={zoom} min={1} max={6} step={0.5} onChange={setZoom} />
        <div className="meta">
          {output === 'svg'
            ? 'vector, sharp at any zoom'
            : 'raster, blurs when scaled up'}
        </div>

        <h2>Animation</h2>
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

            {output === 'canvas' ? (
              <AsciiCanvas
                {...render}
                source={source}
                fontSize={fontSize}
                background={backdropKind === 'none' ? undefined : '#000'}
                backdrop={backdrop}
                blend={glyphBlend}
                style={scaled}
              />
            ) : (
              <AsciiSvg
                {...render}
                source={source}
                fontSize={fontSize}
                background={backdropKind === 'none' ? undefined : '#000'}
                style={scaled}
              />
            )}

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
