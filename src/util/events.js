import { statements } from '../db.js';
import { logger } from '../logger.js';

export function recordEvent(kind, detail = {}) {
  statements.event.run(kind, JSON.stringify(detail));
  logger.info({ kind, detail }, 'event');
}
export function apiError(res, status, code, message) {
  return res.status(status).json({ ok: false, error: { code, message } });
}
// Express 4 does not automatically forward rejected promises.
export const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function sameOrigin(req, res, next) {
  // Require a browser Origin for mutations, including anonymous reports.
  let origin;
  try { origin = new URL(req.get('origin')).origin; } catch { return apiError(res, 403, 'CSRF', 'A same-origin request is required.'); }
  const expected = `${req.protocol}://${req.get('host')}`;
  if (origin !== expected || req.get('sec-fetch-site') === 'cross-site') return apiError(res, 403, 'CSRF', 'Cross-site requests are not allowed.');
  next();
}
