import preset from './herbarium-preset.json';
import { adjustPixels, animation, cellDrawn, clamp, maskCoverage, sampleCells, seed } from './math.js';
import { drawPrimitive } from './primitives.js';
export function parameters(overrides = {}) {
  return { ...preset, ...overrides, pfx: { ...preset.pfx, ...overrides.pfx }, mask: { ...preset.mask, ...overrides.mask }, lights: { ...preset.lights, ...overrides.lights } };
}
const enabled = (p, key) => p.pfx[key]?.enabled ? clamp(p.pfx[key].intensity / 100) : 0;
export class AsciiRenderer {
  constructor(canvas, factory = () => document.createElement('canvas')) {
    this.canvas = canvas; this.factory = factory; this.buffers = {};
  }
  buffer(name, w = this.width, h = this.height) {
    const canvas = this.buffers[name] ||= this.factory();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return canvas;
  }
  setSource(image, width, height, cellSize = 13) {
    this.width = Math.max(1, Math.round(width)); this.height = Math.max(1, Math.round(height));
    this.canvas.width = this.width; this.canvas.height = this.height;
    const photo = this.buffer('photo'), ctx = photo.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    const ratio = Math.max(this.width / iw, this.height / ih);
    ctx.drawImage(image, (this.width - iw * ratio) / 2, (this.height - ih * ratio) / 2, iw * ratio, ih * ratio);
    this.photoData = ctx.getImageData(0, 0, this.width, this.height);
    this.sample(cellSize); this.maskImage = null;
  }
  sample(cellSize) {
    this.grid = sampleCells(this.photoData.data, this.width, this.height, cellSize);
  }
  setMask(image, invert = false) {
    const mask = this.buffer('mask'), ctx = mask.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height); ctx.drawImage(image, 0, 0, this.width, this.height);
    const pixels = ctx.getImageData(0, 0, this.width, this.height);
    pixels.data.set(maskCoverage(pixels.data, invert)); ctx.putImageData(pixels, 0, 0);
    this.maskImage = mask;
  }
  snapshot(canvas) {
    const copy = this.buffer('snapshot'); const ctx = copy.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height); ctx.drawImage(canvas, 0, 0); return copy;
  }
  blur(canvas, type, amount) {
    if (type === 'off' || !amount) return;
    const ctx = canvas.getContext('2d'), copy = this.snapshot(canvas), w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h); ctx.save();
    if (type === 'motion' || type === 'radial') {
      ctx.globalAlpha = 1 / 9; ctx.globalCompositeOperation = 'lighter';
      for (let i = -4; i <= 4; i++) {
        const delta = i * amount * .07;
        if (type === 'motion') ctx.drawImage(copy, delta, 0);
        else { const scale = 1 + delta / 100; ctx.drawImage(copy, w * (1 - scale) / 2, h * (1 - scale) / 2, w * scale, h * scale); }
      }
    } else { ctx.filter = `blur(${amount * .12}px)`; ctx.drawImage(copy, 0, 0); }
    ctx.restore();
  }
  glow(ctx, source, amount, radius = 7) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = amount * .55;
    ctx.filter = `blur(${radius}px)`; ctx.drawImage(source, 0, 0); ctx.restore();
  }
  chromatic(canvas, intensity) {
    const ctx = canvas.getContext('2d'), source = this.snapshot(canvas), w = this.width, h = this.height;
    const pixels = source.getContext('2d').getImageData(0, 0, w, h), output = ctx.createImageData(w, h), offset = Math.max(1, Math.round(intensity * 9));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = (y * w + clamp(x - offset, 0, w - 1)) * 4, b = (y * w + clamp(x + offset, 0, w - 1)) * 4;
      output.data[i] = pixels.data[r]; output.data[i + 1] = pixels.data[i + 1]; output.data[i + 2] = pixels.data[b + 2]; output.data[i + 3] = pixels.data[i + 3];
    }
    ctx.putImageData(output, 0, 0);
  }
  post(canvas, p, time) {
    const ctx = canvas.getContext('2d'), w = this.width, h = this.height, tick = Math.floor(time / 100);
    let intensity;
    if ((intensity = enabled(p, 'pixelate'))) {
      const step = Math.max(2, Math.round(intensity * 24)), small = this.buffer('small', Math.ceil(w / step), Math.ceil(h / step));
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
      ctx.save(); ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, w, h); ctx.restore();
    }
    if ((intensity = enabled(p, 'bloom'))) this.glow(ctx, this.snapshot(canvas), intensity, 3 + intensity * 12);
    if ((intensity = Math.max(enabled(p, 'chromatic'), enabled(p, 'rgbSplit')))) this.chromatic(canvas, intensity);
    if ((intensity = enabled(p, 'glitch'))) {
      const copy = this.snapshot(canvas);
      for (let i = 0; i < 8; i++) {
        if (seed(i, tick) > intensity) continue;
        const yy = seed(i, tick + 2) * h, sh = 2 + seed(i, tick + 3) * h * .05, dx = (seed(i, tick + 4) - .5) * intensity * w * .12;
        ctx.drawImage(copy, 0, yy, w, sh, dx, yy, w, sh);
      }
    }
    if ((intensity = enabled(p, 'crtCurvature'))) {
      const copy = this.snapshot(canvas); ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { const inset = Math.pow((y / h - .5) * 2, 2) * w * .065 * intensity; ctx.drawImage(copy, 0, y, w, 2, inset, y, w - inset * 2, 2); }
    }
    if ((intensity = enabled(p, 'scanLines'))) { ctx.fillStyle = `rgba(0,0,0,${intensity * .6})`; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1); }
    if ((intensity = enabled(p, 'halftone'))) {
      ctx.fillStyle = `rgba(0,0,0,${intensity * .65})`;
      for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 7) { ctx.beginPath(); ctx.arc(x + (y % 2 ? 3 : 0), y, 1 + intensity, 0, Math.PI * 2); ctx.fill(); }
    }
    if ((intensity = enabled(p, 'filmGrain'))) {
      const pixels = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < pixels.data.length; i += 4) { const noise = (seed(i, tick) - .5) * intensity * 65; for (let k = 0; k < 3; k++) pixels.data[i + k] += noise; }
      ctx.putImageData(pixels, 0, 0);
    }
    if ((intensity = enabled(p, 'filmDust'))) {
      ctx.save(); ctx.globalAlpha = intensity * .7; ctx.fillStyle = '#eee3ca'; ctx.strokeStyle = '#ece1cf';
      for (let i = 0; i < Math.ceil(60 * intensity); i++) { const x = seed(i, tick + 91) * w, y = seed(i, tick + 83) * h; ctx.fillRect(x, y, 1, 1 + seed(i, tick + 72) * 4); if (i % 7 === 0) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 20); ctx.stroke(); } }
      ctx.restore();
    }
    if ((intensity = enabled(p, 'vignette'))) {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .15, w / 2, h / 2, Math.hypot(w, h) * .55);
      gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, `rgba(0,0,0,${intensity})`); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    }
  }
  render(overrides = {}, time = 0) {
    if (!this.photoData) return;
    const p = parameters(overrides), w = this.width, h = this.height;
    if (this.grid.size !== Math.max(1, Math.round(p.cellSize))) this.sample(p.cellSize);
    const layer = this.buffer('primitives'), primitive = layer.getContext('2d'), result = this.buffer('result'), ctx = result.getContext('2d');
    primitive.clearRect(0, 0, w, h); ctx.clearRect(0, 0, w, h);
    if (p.bgMode !== 'none' && p.bgMode !== 'transparent') {
      ctx.save(); ctx.globalAlpha = clamp(p.bgOpacity / 100);
      if (p.bgMode === 'solid' || p.bgMode === 'color') { ctx.fillStyle = p.bgColor || '#0a0a0c'; ctx.fillRect(0, 0, w, h); }
      else { if (p.bgMode === 'blur') ctx.filter = `blur(${p.bgBlur}px)`; ctx.drawImage(this.buffers.photo, 0, 0); }
      ctx.restore();
    }
    this.grid.cells.forEach((c, index) => {
      if (!cellDrawn(index, p.coverage)) return;
      let level = p.invert ? 1 - c.lum : c.lum;
      level = clamp(level + (p.density || 0) / 100 + c.edge * (p.edgeEmphasis || 0) / 100 + animation(p, c.x - w / 2, c.y - h / 2, time, index));
      if (p.dotGrid) { primitive.fillStyle = 'rgba(255,255,255,.12)'; primitive.fillRect(c.x, c.y, 1, 1); }
      drawPrimitive(primitive, c, level, p, index, time, this.grid);
    });
    if (enabled(p, 'characterChromatic')) this.chromatic(layer, enabled(p, 'characterChromatic'));
    if (enabled(p, 'characterBloom')) this.glow(primitive, this.snapshot(layer), enabled(p, 'characterBloom'), 4);
    ctx.save(); ctx.globalCompositeOperation = p.styleBlend || 'source-over'; ctx.drawImage(layer, 0, 0); ctx.restore();
    // Raster adjustments follow the requested order, before tint and blur.
    if (p.brightness || p.contrast !== 100 || p.saturation !== 100 || p.grayscale) {
      const pixels = ctx.getImageData(0, 0, w, h);
      adjustPixels(pixels.data, p);
      ctx.putImageData(pixels, 0, 0);
    }
    if (p.tintOpacity) {
      ctx.save(); ctx.globalCompositeOperation = p.overlayBlend || 'soft-light'; ctx.globalAlpha = clamp(p.tintOpacity / 100); ctx.fillStyle = p.tint; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    this.blur(result, p.blurType, p.blurAmount); this.post(result, p, time);
    if (p.lights.enabled) for (const light of p.lights.points) {
      const x = clamp(light.x) * w, y = clamp(light.y) * h, radius = Math.max(1, (light.radius <= 1 ? light.radius * Math.min(w, h) : light.radius));
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255,238,195,${clamp((light.intensity ?? 50) / 100)})`); gradient.addColorStop(1, 'transparent');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    if (p.mask.enabled && this.maskImage) {
      const reveal = this.buffer('reveal'), rctx = reveal.getContext('2d'); rctx.clearRect(0, 0, w, h); rctx.drawImage(this.buffers.photo, 0, 0);
      rctx.globalCompositeOperation = 'destination-in'; rctx.drawImage(this.maskImage, 0, 0); rctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(reveal, 0, 0);
    }
    const output = this.canvas.getContext('2d'); output.clearRect(0, 0, w, h); output.drawImage(result, 0, 0);
  }
  dispose() { this.buffers = {}; this.photoData = this.grid = this.maskImage = null; }
}
