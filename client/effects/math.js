export const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export const luminance = (r, g, b) => (r * .2126 + g * .7152 + b * .0722) / 255;
export function seed(index, salt = 0) {
  let n = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
export function sampleCells(data, width, height, cellSize) {
  const size = Math.max(1, Math.round(cellSize)), cols = Math.ceil(width / size), rows = Math.ceil(height / size), cells = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * size, y = row * size, w = Math.min(size, width - x), h = Math.min(size, height - y);
    const rgb = [0, 0, 0], top = [0, 0, 0], bottom = [0, 0, 0]; let nt = 0, nb = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const offset = ((y + yy) * width + x + xx) * 4, half = yy < Math.ceil(h / 2) ? top : bottom;
      for (let k = 0; k < 3; k++) { rgb[k] += data[offset + k]; half[k] += data[offset + k]; }
      if (half === top) nt++; else nb++;
    }
    for (let k = 0; k < 3; k++) { rgb[k] /= w * h; top[k] /= nt || 1; bottom[k] = nb ? bottom[k] / nb : top[k]; }
    cells.push({ x, y, w, h, col, row, rgb, top, bottom, lum: luminance(...rgb) });
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i], right = cells[Math.min(cols - 1, c.col + 1) + c.row * cols], down = cells[c.col + Math.min(rows - 1, c.row + 1) * cols];
    c.edge = Math.hypot(c.lum - right.lum, c.lum - down.lum);
  }
  return { cells, cols, rows, size };
}
export function adjustedRGB(rgb, p) {
  let color = rgb.map(v => v + (p.brightness || 0) * 2.55);
  color = color.map(v => (v - 127.5) * (p.contrast ?? 100) / 100 + 127.5);
  let gray = luminance(...color) * 255;
  color = color.map(v => gray + (v - gray) * (p.saturation ?? 100) / 100);
  gray = luminance(...color) * 255;
  return color.map(v => clamp(v + (gray - v) * clamp((p.grayscale || 0) / 100), 0, 255));
}
export function adjustPixels(data, p) {
  const offset = (p.brightness || 0) * 2.55, contrast = (p.contrast ?? 100) / 100;
  const saturation = (p.saturation ?? 100) / 100, grayscale = clamp((p.grayscale || 0) / 100);
  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] + offset - 127.5) * contrast + 127.5;
    let g = (data[i + 1] + offset - 127.5) * contrast + 127.5;
    let b = (data[i + 2] + offset - 127.5) * contrast + 127.5;
    let gray = r * .2126 + g * .7152 + b * .0722;
    r = gray + (r - gray) * saturation; g = gray + (g - gray) * saturation; b = gray + (b - gray) * saturation;
    gray = r * .2126 + g * .7152 + b * .0722;
    data[i] = r + (gray - r) * grayscale; data[i + 1] = g + (gray - g) * grayscale; data[i + 2] = b + (gray - b) * grayscale;
  }
}
export function cellDrawn(index, coverage = 100) { return seed(index, 83) < clamp(coverage / 100); }
export function animation(p, x, y, time, index = 0) {
  if (!p.animated || !p.animIntensity?.enabled) return 0;
  const t = time / 1000 * (p.animSpeed?.enabled ? p.animSpeed.intensity / 100 : 1);
  const random = p.animRandomness?.enabled ? p.animRandomness.intensity / 100 : 0;
  const phase = seed(index, 17) * Math.PI * 2 * random;
  let value;
  switch (p.animStyle) {
    case 'wave': value = Math.sin(x * .025 + t * 2 + phase); break;
    case 'pulse': value = Math.sin(t * 2 + phase * .1); break;
    case 'shimmer': value = Math.sin(x * .09 + y * .11 - t * 3 + phase); break;
    case 'flicker': value = seed(index, Math.floor(t * 12)) * 2 - 1; break;
    default: value = Math.sin(Math.hypot(x, y) * .028 - t * 2.4 + phase * .2);
  }
  return value * clamp(p.animIntensity.intensity / 100) * .22;
}
// Opaque grayscale masks use luminance; alpha-painted masks use alpha alone.
export function maskCoverage(data, invert = false) {
  let alphaMask = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { alphaMask = true; break; }
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const coverage = alphaMask ? data[i + 3] / 255 : luminance(data[i], data[i + 1], data[i + 2]);
    output[i] = output[i + 1] = output[i + 2] = 255; output[i + 3] = (invert ? 1 - coverage : coverage) * 255;
  }
  return output;
}
