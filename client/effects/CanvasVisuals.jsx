import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context.jsx';
import { AsciiRenderer, parameters } from './renderer.js';

// One clock per artwork. Time excludes offscreen/hidden/paused intervals.
function useCanvasLoop(ref, setup, draw, deps, animated = true) {
  const { motion } = useApp();
  const motionRef = useRef(motion && animated), drawRef = useRef(draw), restart = useRef(() => {});
  motionRef.current = motion && animated; drawRef.current = draw;
  useEffect(() => { restart.current(); }, [motion, animated]);
  useEffect(() => {
    const canvas = ref.current; let frame = 0, last = 0, elapsed = 0, visible = true, destroyed = false, cleanup;
    const size = () => {
      const box = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1000 / Math.max(1, box.width));
      const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
      canvas.width = width; canvas.height = height; cleanup?.(); cleanup = setup(canvas, width, height, ratio); restart.current();
    };
    const render = now => {
      if (destroyed) return;
      if (!last || now - last >= 1000 / 30) { elapsed += last ? Math.min(now - last, 100) : 0; last = now; drawRef.current(canvas, elapsed); }
      if (motionRef.current && visible && !document.hidden) frame = requestAnimationFrame(render);
    };
    const start = () => {
      cancelAnimationFrame(frame); last = 0;
      if (destroyed || document.hidden || !visible) return;
      drawRef.current(canvas, elapsed);
      if (motionRef.current) frame = requestAnimationFrame(render);
    };
    restart.current = start;
    const resize = new ResizeObserver(size), intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; start(); });
    resize.observe(canvas); intersection.observe(canvas); document.addEventListener('visibilitychange', start); size();
    return () => { destroyed = true; cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', start); cleanup?.(); restart.current = () => {}; };
  }, deps);
  return restart;
}
export function AsciiCanvas({ source = '/public/img/ref-045.webp', overrides = {}, className = '' }) {
  const ref = useRef(), engine = useRef(), image = useRef(), mask = useRef(), p = parameters(overrides), pRef = useRef(p), [error, setError] = useState('');
  pRef.current = p;
  const key = JSON.stringify(overrides);
  const restart = useCanvasLoop(ref, (canvas, width, height, ratio) => {
    const renderer = new AsciiRenderer(canvas); engine.current = renderer;
    const paint = () => { if (!image.current) return; renderer.setSource(image.current, width, height, pRef.current.cellSize * ratio); if (mask.current) renderer.setMask(mask.current, pRef.current.mask.invert); renderer.render({ ...pRef.current, cellSize: pRef.current.cellSize * ratio }); };
    renderer.ratio = ratio; renderer.paint = paint; paint(); return () => renderer.dispose();
  }, (canvas, time) => { if (engine.current) engine.current.render({ ...pRef.current, cellSize: pRef.current.cellSize * engine.current.ratio }, time); }, [source, key], p.animated || p.renderMode === 'matrix');
  useEffect(() => {
    let alive = true; image.current = null; setError('');
    const photo = new Image(); photo.onload = () => { if (alive) { image.current = photo; engine.current?.paint(); restart.current(); } };
    photo.onerror = () => { if (alive) setError('Artwork unavailable. The guide is still fully accessible.'); }; photo.src = source;
    return () => { alive = false; photo.onload = photo.onerror = null; };
  }, [source]);
  useEffect(() => {
    let alive = true; mask.current = null;
    if (!p.mask.enabled || !p.mask.dataUrl) return;
    const img = new Image(); img.onload = () => { if (alive) { mask.current = img; engine.current?.setMask(img, p.mask.invert); restart.current(); } }; img.src = p.mask.dataUrl;
    return () => { alive = false; img.onload = null; };
  }, [p.mask.enabled, p.mask.dataUrl, p.mask.invert]);
  return <div className={`ascii-art ${className}`}><canvas ref={ref} aria-label="Herbarium: a golden botanical photograph rendered as animated dither cells" role="img" />{error && <p className="art-error">{error}</p>}</div>;
}
export function VoxelArc() {
  const ref = useRef();
  useCanvasLoop(ref, () => {}, (canvas, time) => {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, t = time / 1000;
    ctx.clearRect(0, 0, w, h);
    for (let row = 0; row < 18; row++) {
      const depth = row / 17, count = 65, size = 1.5 + depth * 5;
      for (let col = 0; col < count; col++) {
        const x = col / (count - 1) * w, nx = (x / w - .5) * 2;
        const wave = Math.sin(col * .16 + row * .3 - t * .5) * (2 + depth * 10);
        const y = h * .12 + depth * depth * h * .66 + nx * nx * h * .24 + wave;
        ctx.fillStyle = `rgba(${depth > .6 ? '255,68,89' : '198,96,102'},${.13 + depth * .5})`;
        ctx.fillRect(x - size / 2, y, size, size); ctx.fillStyle = `rgba(255,211,192,${depth * .22})`; ctx.fillRect(x - size / 2, y, size, 1);
      }
    }
  }, []);
  return <canvas className="voxel-arc" ref={ref} aria-hidden="true" />;
}
