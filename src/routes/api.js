import { Router } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { publicUser, statements } from '../db.js';
import { TOOL, REQUIREMENTS, STEPS, VERIFY, REVERT, REFERENCE, TROUBLE } from '../content/steps.js';
import { asyncRoute } from '../util/events.js';
import { downloadMetadata } from './downloads.js';

export const apiRouter = Router();
apiRouter.get('/health', (req, res) => res.json({ ok: true, data: { ok: true, uptime: Math.round(process.uptime()), version: config.version } }));
apiRouter.get('/stats', (req, res) => res.json({ ok: true, data: statements.stats.get() }));
apiRouter.get('/media', (req, res) => res.json({ ok: true, data: { ambient: existsSync(path.join(config.root, 'public/audio/li7wak.mp3')), source: '/public/audio/li7wak.mp3' } }));
apiRouter.get('/tool', (req, res) => res.json({ ok: true, data: { ...TOOL, requirements: REQUIREMENTS, steps: STEPS, verify: VERIFY, revert: REVERT, reference: REFERENCE, trouble: TROUBLE } }));
apiRouter.get('/auth/me', (req, res) => res.json({ ok: true, data: { user: publicUser(req.user), discordEnabled: config.discordEnabled } }));
apiRouter.get('/downloads', asyncRoute(async (req, res) => res.json({ ok: true, data: await downloadMetadata() })));
