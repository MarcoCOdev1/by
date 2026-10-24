import { Router } from 'express';
import { config } from '../config.js';
import { statements } from '../db.js';
import { apiError, recordEvent, sameOrigin } from '../util/events.js';
import { reportLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logger } from '../logger.js';

export const reportsRouter = Router();
reportsRouter.get('/', requireAuth, (req, res) => res.json({ ok: true, data: statements.reports.all(req.user.id) }));
reportsRouter.post('/', sameOrigin, reportLimit, (req, res) => {
  const { title, body, os = '', appver = '', website = '' } = req.body || {};
  if (website) return apiError(res, 400, 'INVALID_REPORT', 'Invalid report.');
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 120 ||
      typeof body !== 'string' || body.trim().length < 10 || body.length > 5000 ||
      typeof os !== 'string' || os.length > 100 || typeof appver !== 'string' || appver.length > 50) {
    return apiError(res, 400, 'INVALID_REPORT', 'Use a title of 3–120 characters and details of 10–5000 characters.');
  }
  const result = statements.report.run(req.user?.id || null, title.trim(), body.trim(), os.trim(), appver.trim());
  const id = Number(result.lastInsertRowid);
  recordEvent('report_created', { reportId: id, userId: req.user?.id || null });
  if (config.webhookUrl) {
    // The report remains saved even when the external webhook is unavailable.
    void fetch(config.webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{
        title: `Report #${id}: ${title.trim()}`, description: body.trim().slice(0, 4000), color: 0xff3b41,
        fields: [{ name: 'OS / version', value: `${os || 'Not provided'} / ${appver || 'Not provided'}` },
          { name: 'Reporter', value: req.user?.id || 'Anonymous' }]
      }] })
    }).then(response => {
      if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`);
      recordEvent('report_webhook', { reportId: id });
    }).catch(error => logger.warn({ reportId: id, message: error.message }, 'Report webhook failed'));
  }
  res.status(201).json({ ok: true, data: { id, status: 'open' } });
});
