import { statements } from '../db.js';
import { apiError } from '../util/events.js';

export function loadUser(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  req.user = req.session?.uid ? statements.user.get(req.session.uid) : null;
  if (req.user?.banned) {
    req.session.destroy(() => {});
    req.user = null;
    return apiError(res, 403, 'BANNED', 'This account has been banned.');
  }
  next();
}
export function requireAuth(req, res, next) {
  if (!req.user) return apiError(res, 401, 'AUTH_REQUIRED', 'Log in with Discord first.');
  next();
}
