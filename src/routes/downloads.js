import { Router } from 'express';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { statements } from '../db.js';
import { apiError, asyncRoute, recordEvent } from '../util/events.js';

export const FILES = ['FPS-Unlocker.exe', 'tuto.md'];
const folder = path.join(config.dataDir, 'downloads');
const cache = new Map();
export async function resolveDownload(file) {
  if (!FILES.includes(file)) return null;
  let target = path.join(folder, file);
  if (file === 'FPS-Unlocker.exe') {
    try { await stat(target); } catch { target = path.join(folder, 'FPS Unlocker.exe'); }
  }
  try {
    const actual = await realpath(target);
    const directory = await realpath(folder);
    if (path.dirname(actual) !== directory || !(await stat(actual)).isFile()) return null;
    return actual;
  } catch { return null; }
}
export async function downloadMetadata() {
  return Promise.all(FILES.map(async file => {
    const target = await resolveDownload(file);
    if (!target) return { file, size: 0, sha256: null, hits: statements.hits.get(file).hits, available: false };
    const info = await stat(target);
    const key = `${target}:${info.size}:${info.mtimeMs}`;
    let digest = cache.get(file);
    if (digest?.key !== key) {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(target)) hash.update(chunk);
      digest = { key, sha256: hash.digest('hex') };
      cache.set(file, digest);
    }
    return { file, size: info.size, sha256: digest.sha256, hits: statements.hits.get(file).hits, available: true };
  }));
}
export const downloadsRouter = Router();
downloadsRouter.get('/:file', asyncRoute(async (req, res, next) => {
  const target = await resolveDownload(req.params.file);
  if (!target) return apiError(res, 404, 'DOWNLOAD_NOT_FOUND', 'That download is not available.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(target, req.params.file, error => {
    if (error) return next(error);
    if (req.method !== 'GET') return;
    statements.download.run(req.params.file, req.user?.id || null, req.ip, (req.get('user-agent') || '').slice(0, 500));
    recordEvent('download', { file: req.params.file, userId: req.user?.id || null });
  });
}));
