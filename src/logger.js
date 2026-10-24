import pino from 'pino';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

mkdirSync(config.logDir, { recursive: true });
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: ['access_token', 'refresh_token', 'token', 'password', 'clientSecret', 'botToken', 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' }
}, pino.destination({ dest: path.join(config.logDir, 'app.log'), sync: true }));
