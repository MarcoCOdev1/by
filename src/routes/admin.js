import { Router } from 'express';
import { sendFrontend } from '../util/frontend.js';
import { config } from '../config.js';
import { db, statements } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { apiError, recordEvent, sameOrigin } from '../util/events.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get('/', sendFrontend);
adminRouter.get('/stats', (req, res) => res.json({ ok: true, data: {
  ...statements.stats.get(), reports: db.prepare('SELECT COUNT(*) AS count FROM reports WHERE status=?').get('open').count,
  events: db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 20').all()
} }));
adminRouter.get('/users', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
  const offset = Math.max(0, Math.min(1_000_000, Number.parseInt(req.query.offset, 10) || 0));
  res.json({ ok: true, data: statements.search.all({ query: `%${query.replace(/[\\%_]/g, '\\$&')}%`, offset }) });
});
adminRouter.post('/users/:id', sameOrigin, (req, res) => {
  const user = statements.user.get(req.params.id);
  if (!user) return apiError(res, 404, 'USER_NOT_FOUND', 'User not found.');
  const { action } = req.body || {};
  if (!['ban', 'unban', 'promote', 'demote'].includes(action)) return apiError(res, 400, 'INVALID_ACTION', 'Unknown user action.');
  if (req.params.id === req.user.id || config.adminIds.includes(req.params.id)) return apiError(res, 403, 'PROTECTED_ADMIN', 'Self and configured owner accounts are protected.');
  // Only configured owners can grant or remove administrator privileges.
  if (['promote', 'demote'].includes(action) && !config.adminIds.includes(req.user.id)) return apiError(res, 403, 'OWNER_REQUIRED', 'Only a configured owner can change administrator privileges.');
  if (['ban', 'unban'].includes(action)) statements.ban.run(action === 'ban' ? 1 : 0, req.params.id);
  else statements.promote.run(action === 'promote' ? 1 : 0, req.params.id);
  recordEvent('admin_user_action', { actor: req.user.id, target: req.params.id, action });
  res.json({ ok: true, data: { id: req.params.id, action } });
});
adminRouter.get('/reports', (req, res) => {
  const status = ['open', 'investigating', 'resolved', 'closed'].includes(req.query.status) ? req.query.status : null;
  const reports = status ? db.prepare('SELECT * FROM reports WHERE status=? ORDER BY id DESC LIMIT 200').all(status)
    : db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 200').all();
  res.json({ ok: true, data: reports });
});
adminRouter.post('/reports/:id', sameOrigin, (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'investigating', 'resolved', 'closed'].includes(status)) return apiError(res, 400, 'INVALID_STATUS', 'Unknown report status.');
  if (!/^\d+$/.test(req.params.id) || !statements.triage.run(status, req.params.id).changes) return apiError(res, 404, 'REPORT_NOT_FOUND', 'Report not found.');
  recordEvent('admin_report_action', { actor: req.user.id, reportId: req.params.id, status });
  res.json({ ok: true, data: { status } });
});
export function csvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet formula injection also applies to leading whitespace/control characters.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
adminRouter.get('/export.csv', (req, res) => {
  const columns = ['id', 'username', 'global_name', 'joined_guild', 'joined_at', 'last_login', 'login_count', 'banned', 'is_admin', 'created_at'];
  res.setHeader('Content-Disposition', 'attachment; filename="bypasser-users.csv"');
  res.type('text/csv; charset=utf-8');
  res.write(`\uFEFF${columns.join(',')}\r\n`);
  for (const user of db.prepare(`SELECT ${columns.join(',')} FROM users ORDER BY created_at DESC`).iterate()) {
    res.write(`${columns.map(key => csvCell(user[key])).join(',')}\r\n`);
  }
  res.end();
  recordEvent('admin_export', { actor: req.user.id });
});
