import { clamp, seed, luminance, animation } from './math.js';
export const MODES = ['characters', 'dither', 'mosaic', 'pixel', 'dots', 'cross', 'diamond', 'voxel', 'lego', 'mixed', 'lines', 'diagonal', 'braille', 'disco', 'hexdump', 'matrix', 'rings', 'hearts', 'stars', 'hexagons', 'triangles', 'bubbles', 'hatch', 'contour', 'halfblocks'];
export const RAMPS = { standard: ' .:-=+*#%@', detailed: ' .`^",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$', blocks: ' ░▒▓█', binary: ' 01', minimal: ' .oO@' };
export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const color = rgb => `rgb(${rgb.map(Math.round).join(',')})`;
function polygon(ctx, x, y, radius, count, phase = -Math.PI / 2, alternating = false) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const r = alternating && i % 2 ? radius * .42 : radius, a = phase + i / count * Math.PI * 2;
    const xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r;
    if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
  }
  ctx.closePath(); ctx.fill();
}
function circle(ctx, x, y, r, fill = true) { ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); }
export function drawPrimitive(ctx, c, level, p, index, time, grid) {
  const { x, y, w, h, rgb } = c, cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h), r = s * (.12 + level * .38);
  let mode = p.renderMode;
  if (mode === 'mixed') mode = ['dots', 'diamond', 'cross', 'characters', 'rings'][Math.floor(seed(index, 51) * 5)];
  ctx.fillStyle = ctx.strokeStyle = color(rgb); ctx.lineWidth = Math.max(.6, s * .055); ctx.globalAlpha = .35 + level * .65;
  const line = (a, b, d, e) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(d, e); ctx.stroke(); };
  switch (mode) {
    case 'characters': case 'hexdump': case 'matrix': {
      const ramp = mode === 'hexdump' ? '0123456789ABCDEF' : mode === 'matrix' ? '0123456789アイウエオカキクケコ' : p.customChars || RAMPS[p.charSet] || RAMPS.standard;
      let glyph = Array.from(ramp)[Math.min(Array.from(ramp).length - 1, Math.floor(level * Array.from(ramp).length))];
      if (mode === 'matrix') {
        const speed = p.animSpeed?.enabled ? p.animSpeed.intensity / 100 : 1;
        const head = (time / 1000 * speed * 7 + seed(c.col, 4) * grid.rows) % (grid.rows + 12);
        const tail = (head - c.row + grid.rows + 12) % (grid.rows + 12);
        ctx.globalAlpha = tail < 12 ? (1 - tail / 12) * (.4 + level * .6) : .08;
        ctx.fillStyle = tail < 1 ? '#d5ffdf' : '#32ed70';
        glyph = Array.from(ramp)[Math.floor(seed(index, Math.floor(time / 160)) * Array.from(ramp).length)];
      }
      ctx.font = `${Math.max(3, s * (.55 + level * .45))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, cx, cy); break;
    }
    case 'dither': {
      ctx.globalAlpha = .95;
      const unit = s / 4;
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
        if (level > (BAYER[yy][xx] + .5) / 16) ctx.fillRect(x + xx * w / 4, y + yy * h / 4, unit * .78, unit * .78);
      }
      break;
    }
    case 'mosaic': ctx.fillRect(x + 1, y + 1, w - 2, h - 2); break;
    case 'pixel': ctx.fillRect(cx - r, cy - r, r * 2, r * 2); break;
    case 'dots': circle(ctx, cx, cy, r * .75); break;
    case 'cross': line(cx - r, cy, cx + r, cy); line(cx, cy - r, cx, cy + r); break;
    case 'diamond': polygon(ctx, cx, cy, r, 4); break;
    case 'voxel': {
      ctx.fillRect(cx - r, cy - r, r * 1.7, r * 1.7);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(cx - r, cy - r, r * 1.7, r * .3);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(cx + r * .45, cy - r * .7, r * .25, r * 1.4); break;
    }
    case 'lego': ctx.fillRect(x + .5, y + .5, w - 1, h - 1); ctx.fillStyle = 'rgba(255,255,255,.2)'; circle(ctx, cx, cy, s * .23); ctx.strokeStyle = 'rgba(0,0,0,.4)'; circle(ctx, cx, cy, s * .23, false); break;
    case 'lines': for (let i = 0; i < Math.ceil(level * 4); i++) line(x + 1, y + (i + 1) * h / 5, x + w - 1, y + (i + 1) * h / 5); break;
    case 'diagonal': line(cx - r, cy + r, cx + r, cy - r); break;
    case 'braille': {
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 2; xx++) if (level > seed(index * 8 + yy * 2 + xx, 32)) circle(ctx, x + (xx + .5) * w / 2, y + (yy + .5) * h / 4, s * .09);
      break;
    }
    case 'disco': ctx.fillStyle = `hsl(${(level * 360 + time / 60) % 360} 85% 60%)`; polygon(ctx, cx, cy, r, 4, time / 1500 + seed(index) * 3); break;
    case 'rings': for (let i = 1; i <= 3; i++) circle(ctx, cx, cy, r * i / 3, false); break;
    case 'hearts': {
      ctx.beginPath(); ctx.moveTo(cx, cy + r); ctx.bezierCurveTo(cx - r * 2, cy - r * .2, cx - r, cy - r * 1.7, cx, cy - r * .45); ctx.bezierCurveTo(cx + r, cy - r * 1.7, cx + r * 2, cy - r * .2, cx, cy + r); ctx.fill(); break;
    }
    case 'stars': polygon(ctx, cx, cy, r, 10, -Math.PI / 2, true); break;
    case 'hexagons': polygon(ctx, cx, cy + (c.col % 2 ? h / 2 : 0), s * .55, 6, 0); break;
    case 'triangles': {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color(c.bottom); ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); break;
    }
    case 'bubbles': circle(ctx, cx, cy, r, false); ctx.globalAlpha *= .55; circle(ctx, cx - r * .25, cy - r * .25, r * .15); break;
    case 'hatch': {
      const count = Math.ceil(level * 5);
      for (let i = 0; i < count; i++) { const f = (i + 1) / (count + 1); line(x + w * f, y, x, y + h * f); if (level > .45) line(x + w, y + h * f, x + w * f, y + h); }
      if (level > .7) { line(x, cy, x + w, cy); line(cx, y, cx, y + h); } break;
    }
    case 'contour': drawContour(ctx, c, grid, p, time); break;
    case 'halfblocks': {
      ctx.globalAlpha = 1;
      for (const [half, yy, hh] of [[c.top, y, Math.ceil(h / 2)], [c.bottom, y + Math.ceil(h / 2), Math.floor(h / 2)]]) {
        let l = luminance(...half); if (p.invert) l = 1 - l; l = clamp(l + level - (p.invert ? 1 - c.lum : c.lum));
        ctx.fillStyle = color(half); ctx.globalAlpha = l; ctx.fillRect(x, yy, w, hh);
      } break;
    }
  }
  ctx.globalAlpha = 1;
}
// Marching squares interpolates iso-lines between four neighboring sample centers.
export function drawContour(ctx, c, grid, p, time) {
  if (c.col + 1 >= grid.cols || c.row + 1 >= grid.rows) return;
  const index = c.row * grid.cols + c.col, corners = [c, grid.cells[index + 1], grid.cells[index + grid.cols + 1], grid.cells[index + grid.cols]];
  const points = corners.map(v => [v.x + v.w / 2, v.y + v.h / 2]);
  const values = corners.map(v => clamp((p.invert ? 1 - v.lum : v.lum) + p.density / 100 + v.edge * p.edgeEmphasis / 100 + animation(p, v.x - grid.cols * grid.size / 2, v.y - grid.rows * grid.size / 2, time, v.row * grid.cols + v.col)));
  for (let threshold = .1; threshold < 1; threshold += .1) {
    const cuts = [];
    for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4, a = values[edge], b = values[next];
      if ((a >= threshold) === (b >= threshold)) continue;
      const f = (threshold - a) / (b - a);
      cuts.push([points[edge][0] + (points[next][0] - points[edge][0]) * f, points[edge][1] + (points[next][1] - points[edge][1]) * f]);
    }
    for (let j = 0; j + 1 < cuts.length; j += 2) { ctx.beginPath(); ctx.moveTo(...cuts[j]); ctx.lineTo(...cuts[j + 1]); ctx.stroke(); }
  }
}
