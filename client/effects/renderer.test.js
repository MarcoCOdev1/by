import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import preset from './herbarium-preset.json';
import { AsciiRenderer, parameters } from './renderer.js';
import { MODES, BAYER } from './primitives.js';
import { adjustedRGB, adjustPixels, animation, cellDrawn, maskCoverage, sampleCells, seed } from './math.js';
const disabled = Object.fromEntries(Object.keys(preset.pfx).map(key => [key, { enabled: false, intensity: 90 }]));
const plain = { animated: false, bgMode: 'none', brightness: 0, contrast: 100, saturation: 100, grayscale: 0, tintOpacity: 0, blurType: 'off', pfx: disabled, cellSize: 13 };
function engine() {
  const photo = createCanvas(64, 48), ctx = photo.getContext('2d');
  for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) { ctx.fillStyle = `rgb(${x * 4},${y * 5},${(x + y) * 2})`; ctx.fillRect(x, y, 1, 1); }
  const canvas = createCanvas(64, 48), renderer = new AsciiRenderer(canvas, () => createCanvas(1, 1)); renderer.setSource(photo, 64, 48);
  return { photo, canvas, renderer };
}
const bytes = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
const hash = canvas => createHash('sha256').update(bytes(canvas)).digest('hex');
describe('Herbarium raster pipeline', () => {
  it('keeps the complete supplied preset and default effect values', () => {
    expect(parameters()).toEqual(preset); expect(Object.keys(preset.pfx)).toHaveLength(13);
    expect(preset).toMatchObject({ tint: '#d8b46a', cellSize: 13, renderMode: 'dither', bgMode: 'blur', bgBlur: 12, bgOpacity: 90, tintOpacity: 38, grayscale: 28, contrast: 115, overlayBlend: 'soft-light', animStyle: 'ripple' });
    expect(preset.pfx.bloom).toEqual({ enabled: true, intensity: 45 }); expect(preset.pfx.vignette.intensity).toBe(55);
  });
  it('averages every pixel and preserves partial cells and vertical halves', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 60, 90, 120, 255]);
    const grid = sampleCells(data, 3, 2, 2);
    expect(grid.cells).toHaveLength(2); expect(grid.cells[0].rgb).toEqual([127.5, 127.5, 63.75]);
    expect(grid.cells[0].top).toEqual([127.5, 127.5, 0]); expect(grid.cells[1].w).toBe(1); expect(grid.cells[1].rgb).toEqual([30, 45, 187.5]);
  });
  it('applies brightness then contrast then saturation then grayscale without changing alpha', () => {
    const p = { brightness: 12, contrast: 130, saturation: 72, grayscale: 28 }, input = [80, 120, 160];
    const b = input.map(v => v + 30.6), c = b.map(v => (v - 127.5) * 1.3 + 127.5), gray = c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    const s = c.map(v => gray + (v - gray) * .72), expected = s.map(v => v + (gray - v) * .28);
    adjustedRGB(input, p).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
    const data = new Uint8ClampedArray([...input, 87]); adjustPixels(data, p); expect([...data]).toEqual([...new Uint8ClampedArray(expected), 87]);
  });
  it('uses deterministic monotonic coverage, seeded randomness, and ordered Bayer thresholds', () => {
    expect(seed(5, 9)).toBe(seed(5, 9)); expect(new Set(BAYER.flat()).size).toBe(16);
    const count = coverage => Array.from({ length: 1000 }, (_, i) => cellDrawn(i, coverage)).filter(Boolean).length;
    expect(count(0)).toBe(0); expect(count(100)).toBe(1000); expect(count(25)).toBeLessThan(count(75)); expect(count(50)).toBeGreaterThan(400); expect(count(50)).toBeLessThan(600);
  });
  for (const renderMode of MODES) it(`renders reproducible nonempty ${renderMode} primitives`, () => {
    const { renderer, canvas } = engine(); renderer.render({ ...plain, renderMode }, 600); const first = hash(canvas);
    expect(bytes(canvas).some(v => v > 0)).toBe(true); renderer.render({ ...plain, renderMode }, 600); expect(hash(canvas)).toBe(first);
  });
  it('caches samples and ignores disabled effects/blur amounts', () => {
    const { renderer, canvas } = engine(); const grid = renderer.grid; renderer.render(plain); const first = hash(canvas);
    renderer.render({ ...plain, blurAmount: 100 }); expect(hash(canvas)).toBe(first); expect(renderer.grid).toBe(grid);
    renderer.render({ ...plain, cellSize: 8 }); expect(renderer.grid).not.toBe(grid);
  });
  it('zero coverage is transparent with no background or tint', () => {
    const { renderer, canvas } = engine(); renderer.render({ ...plain, coverage: 0 }); expect(bytes(canvas).every(v => v === 0)).toBe(true);
  });
  it('every post-effect changes the raster only when enabled', () => {
    for (const key of Object.keys(preset.pfx)) {
      const { renderer, canvas } = engine(); renderer.render(plain, 1500); const before = hash(canvas);
      renderer.render({ ...plain, pfx: { ...disabled, [key]: { enabled: true, intensity: 100 } } }, 1500); expect(hash(canvas), key).not.toBe(before);
    }
  });
  it('each blur mode affects output, and background modes are distinct', () => {
    const { renderer, canvas } = engine(); renderer.render(plain); const before = hash(canvas);
    for (const blurType of ['gaussian', 'motion', 'radial']) { renderer.render({ ...plain, blurType, blurAmount: 80 }); expect(hash(canvas), blurType).not.toBe(before); }
    const hashes = ['blur', 'original', 'solid', 'none'].map(bgMode => { renderer.render({ ...plain, bgMode, bgOpacity: 90 }); return hash(canvas); }); expect(new Set(hashes).size).toBe(4);
  });
  it('honors density, inversion, edges, character ramps, and style/tint blends', () => {
    const { renderer, canvas } = engine(); renderer.render(plain); const before = hash(canvas);
    for (const overrides of [{ density: 40 }, { invert: true }, { edgeEmphasis: 100 }, { tintOpacity: 80 }, { bgMode: 'original', styleBlend: 'multiply' }]) { renderer.render({ ...plain, ...overrides }); expect(hash(canvas)).not.toBe(before); }
    renderer.render({ ...plain, renderMode: 'characters', customChars: '#' }); const chars = hash(canvas); renderer.render({ ...plain, renderMode: 'characters', customChars: 'O' }); expect(hash(canvas)).not.toBe(chars);
  });
  it('lights use normalized positions and disabled lights are inert', () => {
    const { renderer, canvas } = engine(); const points = [{ x: .5, y: .5, radius: .5, intensity: 100 }]; renderer.render(plain); const before = hash(canvas);
    renderer.render({ ...plain, lights: { enabled: false, points } }); expect(hash(canvas)).toBe(before);
    renderer.render({ ...plain, lights: { enabled: true, points } }); expect(hash(canvas)).not.toBe(before);
  });
  it('reveals the untouched photo through opaque, alpha, and inverted masks', () => {
    expect([...maskCoverage(new Uint8ClampedArray([255,255,255,255,0,0,0,255]))].filter((_, i) => i % 4 === 3)).toEqual([255, 0]);
    expect([...maskCoverage(new Uint8ClampedArray([0,0,0,128,0,0,0,0]), true)].filter((_, i) => i % 4 === 3)).toEqual([127, 255]);
    const { renderer, canvas, photo } = engine(), mask = createCanvas(64,48), ctx = mask.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0,0,64,48); renderer.setMask(mask);
    renderer.render({ ...plain, mask: { enabled: true } }); expect(hash(canvas)).toBe(hash(photo));
    renderer.setMask(mask, true); renderer.render({ ...plain, mask: { enabled: true } }); const before = hash(canvas); renderer.render(plain); expect(hash(canvas)).toBe(before);
  });
  it('uses timestamp, speed, intensity, style and randomness; matrix self-animates', () => {
    for (const animStyle of ['wave', 'pulse', 'shimmer', 'ripple', 'flicker']) { const p = parameters({ animStyle }); expect(animation(p, 31, 18, 50, 6)).not.toBe(animation(p, 31, 18, 1800, 6)); expect(animation({ ...p, animated: false }, 1, 2, 300)).toBe(0); expect(animation({ ...p, animIntensity: { enabled: false } }, 1, 2, 300)).toBe(0); }
    const p = parameters(); expect(animation({ ...p, animSpeed: { enabled: true, intensity: 0 } }, 31, 18, 50)).toBe(animation({ ...p, animSpeed: { enabled: true, intensity: 0 } }, 31, 18, 1800));
    const { renderer, canvas } = engine(); renderer.render({ ...plain, renderMode: 'matrix' }, 0); const before = hash(canvas); renderer.render({ ...plain, renderMode: 'matrix' }, 1500); expect(hash(canvas)).not.toBe(before);
  });
});
