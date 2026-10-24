import { rateLimit } from 'express-rate-limit';
import { apiError } from '../util/events.js';
const makeLimit = (limit, windowMs) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => apiError(res, 429, 'RATE_LIMITED', 'Too many requests. Please wait and try again.')
});
export const globalLimit = makeLimit(120, 60_000);
export const authLimit = makeLimit(20, 60_000);
export const reportLimit = makeLimit(5, 3_600_000);
