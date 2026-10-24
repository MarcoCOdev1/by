import { config } from '../config.js';
import { apiError } from '../util/events.js';
export function requireAdmin(req, res, next) {
  if (!req.user) return apiError(res, 401, 'AUTH_REQUIRED', 'Log in with Discord first.');
  if (!config.adminIds.includes(req.user.id) && !req.user.is_admin) return apiError(res, 403, 'ADMIN_REQUIRED', 'Administrator access is required.');
  next();
}
