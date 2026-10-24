import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createFrontend, sendFrontend, frontendDev, closeFrontend } from './util/frontend.js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';
import { logger } from './logger.js';
import { sessionMiddleware, sessionStore } from './middleware/session.js';
import { loadUser } from './middleware/requireAuth.js';
import { globalLimit, authLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { downloadsRouter } from './routes/downloads.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { reportsRouter } from './routes/reports.js';
import { apiError } from './util/events.js';
import { ensureAssets } from './util/assets.js';
import { bot, startBot } from './bot/client.js';

ensureAssets();
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
if (frontendDev) app.use((req, res, next) => { res.locals.nonce = randomBytes(18).toString('base64'); next(); });
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: frontendDev ? ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`] : ["'self'"], scriptSrcAttr: ["'none'"],
      styleSrc: frontendDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'], connectSrc: frontendDev ? ["'self'", 'ws:', 'wss:'] : ["'self'"], mediaSrc: ["'self'"],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
      upgradeInsecureRequests: config.production ? [] : null
    }
  },
  strictTransportSecurity: config.production ? undefined : false
}));
app.use(globalLimit, compression(), cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
const publicDir = path.join(config.root, 'public');
app.get('/public/license', (req, res) => res.type('text/plain').sendFile(path.join(config.root, 'LICENSE')));
// Serve assets before sessions; account pages cannot bypass their route guards.
app.use('/public', (req, res, next) => {
  let filename;
  try { filename = path.posix.basename(decodeURIComponent(req.path).replaceAll('\\', '/')).toLowerCase(); }
  catch { return apiError(res, 400, 'INVALID_PATH', 'Invalid asset path.'); }
  if (['dashboard.html', 'admin.html'].includes(filename)) return res.redirect(filename === 'admin.html' ? '/admin' : '/dashboard');
  next();
}, express.static(publicDir, { index: false, dotfiles: 'deny', maxAge: config.production ? '1h' : 0 }));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(publicDir, 'img/favicon.ico')));
export const httpServer = createServer(app);
const vite = await createFrontend(httpServer);
if (vite) app.use(vite.middlewares);
else app.use('/assets', express.static(path.join(config.root, 'dist/client/assets'), { index: false, immutable: true, maxAge: '1y' }));
app.use(sessionMiddleware, loadUser);
app.use('/auth', authLimit, authRouter);
app.use('/api', apiRouter);
app.use('/dl', downloadsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/admin', adminRouter);
app.use('/reports', reportsRouter);
app.get('/', sendFrontend);
app.use((req, res, next) => {
  if (/^\/(api|auth|reports|dl)(\/|$)/.test(req.path)) return apiError(res, 404, 'NOT_FOUND', 'Route not found.');
  if (req.method !== 'GET' && req.method !== 'HEAD') return apiError(res, 404, 'NOT_FOUND', 'Route not found.');
  res.status(404); return sendFrontend(req, res, next);
});
app.use((error, req, res, next) => {
  logger.error({ message: error.message, path: req.path }, 'Request failed');
  if (res.headersSent) return next(error);
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  const message = status === 413 ? 'Request body is too large.' : status === 400 ? 'Invalid request.' : 'The request could not be completed.';
  if (/^\/(api|auth|reports|admin|dl)(\/|$)/.test(req.path)) return apiError(res, status, 'REQUEST_FAILED', message);
  res.status(status).type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Request failed</title><h1>Request could not be completed</h1><a href="/">Return home</a></html>');
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`BYPASSER listening on http://localhost:${config.port}`);
    logger.info({ port: config.port }, 'HTTP server started');
    void startBot();
  });
  server.on('error', error => { console.error(`Server failed: ${error.message}`); process.exit(1); });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    bot.destroy();
    void closeFrontend();
    server.close(() => {
      sessionStore.db.close(() => { db.close(); logger.flush(); process.exit(0); });
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
