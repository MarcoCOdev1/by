import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export const frontendDev = !config.production && process.argv.includes('--dev');
let vite;
export async function createFrontend(httpServer) {
  if (frontendDev) {
    const { createServer } = await import('vite');
    vite = await createServer({ configFile: path.join(config.root, 'vite.config.js'), appType: 'custom', server: { middlewareMode: true, hmr: { server: httpServer, path: '/vite-hmr' }, fs: { allow: [path.join(config.root, 'client'), path.join(config.root, 'node_modules')] } } });
  }
  return vite;
}
export async function sendFrontend(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    if (!vite) return res.sendFile(path.join(config.root, 'dist/client/index.html'));
    let html = await readFile(path.join(config.root, 'client/index.html'), 'utf8');
    html = await vite.transformIndexHtml(req.originalUrl, html);
    html = html.replace(/<script\b/g, `<script nonce="${res.locals.nonce}"`);
    res.type('html').send(html);
  } catch (error) { next(error); }
}
export async function closeFrontend() { await vite?.close(); }
