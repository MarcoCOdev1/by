// Isolated browser acceptance harness. Never run as a production service.
import { mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(path.join(root, 'data/.test-browser-'));
const port = Number(process.env.PREVIEW_TEST_PORT || 3102);
Object.assign(process.env, { NODE_ENV: 'test', PORT: '3102', DATA_DIR: dir, LOG_DIR: path.join(dir, 'logs'), BASE_URL: 'http://localhost:3102', SESSION_SECRET: randomBytes(48).toString('hex'), TRUST_PROXY: '0', DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '', DISCORD_REDIRECT_URI: 'http://localhost:3102/auth/callback', BOT_TOKEN: '', GUILD_ID: '', WELCOME_ROLE_ID: '', DISCORD_WEBHOOK_URL: '', WELCOME_DM: 'false', ADMIN_IDS: '100000000000000010' });
mkdirSync(path.join(dir, 'downloads'));
Object.assign(process.env, { PORT: String(port), BASE_URL: `http://localhost:${port}`, DISCORD_REDIRECT_URI: `http://localhost:${port}/auth/callback`, DOTENV_CONFIG_PATH: path.join(dir, 'no-env-file') });
const { app, httpServer } = await import('../src/index.js');
const { closeFrontend } = await import('../src/util/frontend.js');
const { db } = await import('../src/db.js');
const { sessionStore } = await import('../src/middleware/session.js');
const insert = db.prepare('INSERT INTO users(id,username,global_name,joined_guild,is_admin) VALUES(?,?,?,?,?)');
insert.run('100000000000000010', 'test-owner', 'Preview Owner', 1, 1);
insert.run('100000000000000011', 'test-member', 'Preview Member', 0, 0);
for (let i = 12; i < 114; i++) insert.run(`100000000000000${String(i).padStart(3, '0')}`, `fixture-${i}`, `Fixture ${i}`, 1, 0);
db.prepare('INSERT INTO reports(user_id,title,body,os,appver) VALUES(?,?,?,?,?)').run('100000000000000011', 'Member-only fixture', 'This report belongs only to the preview member.', 'Windows 11', 'test');
// Add routes to the front of this harness only. The application exports no bypass.
const { Router } = await import('express');
const { sessionMiddleware } = await import('../src/middleware/session.js');
const fixture = Router(); fixture.use(sessionMiddleware);
const { globalLimit, authLimit, reportLimit } = await import('../src/middleware/rateLimit.js');
fixture.post('/reset-rate-limits', (req, res) => {
  for (const limiter of [globalLimit, authLimit, reportLimit]) limiter.resetKey(req.ip);
  res.sendStatus(204);
});
fixture.get('/login/:role', (req, res) => {
  const id = req.params.role === 'owner' ? '100000000000000010' : '100000000000000011';
  req.session.regenerate(error => { if (error) return res.status(500).end(); req.session.uid = id; req.session.save(error => { if (error) return res.status(500).end(); res.redirect(req.params.role === 'owner' ? '/admin' : '/dashboard'); }); });
});
fixture.get('/confirm-enrollment', (req, res) => { db.prepare('UPDATE users SET joined_guild=1 WHERE id=?').run('100000000000000011'); res.redirect('/dashboard'); });
app.use('/__test', fixture);
const fixtureLayer = app._router.stack.pop();
app._router.stack.splice(2, 0, fixtureLayer);
const server = httpServer.listen(port, '127.0.0.1', () => console.log(`Isolated browser test preview: http://localhost:${port} (no live Discord, no executable fixture)`));
const close = async () => { await closeFrontend(); server.closeAllConnections(); server.close(() => sessionStore.db.close(() => { db.close(); process.exit(0); })); };
process.on('SIGINT', close); process.on('SIGTERM', close);
