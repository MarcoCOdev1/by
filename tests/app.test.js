import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const testDir = mkdtempSync(path.join(root, 'data/.test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(testDir, 'no-env-file'), DATA_DIR: testDir, LOG_DIR: path.join(testDir, 'logs'),
  BASE_URL: 'https://flowersland.xyz', DISCORD_REDIRECT_URI: 'https://flowersland.xyz/auth/callback',
  SESSION_SECRET: randomBytes(48).toString('hex'), TRUST_PROXY: '0',
  DISCORD_CLIENT_ID: '1563628460788940830', DISCORD_CLIENT_SECRET: 'K20mtQ4tumzYakuWGaZPKtsONSfeX86N',
  BOT_TOKEN: 'MTU2MzYyODQ2MDc4ODk0MDgzMA.GxZX3Z.1snc76UYWTbrVyi3tIGNYoOgINpPbyprwhEHVk', GUILD_ID: '1563628996812480542', WELCOME_ROLE_ID: '1563629056472125540',
  ADMIN_IDS: '426956456382824451', WELCOME_DM: 'true',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1563629135241281619/nfa05NQKvRor4uaUSKkp0-4LIFwKIJun4ddnYNhbSCWruZWPd5fH1yxlQM8ORjvVfnrF'
});
mkdirSync(path.join(testDir, 'downloads'));
const binary = Buffer.from('MZ\nTest fixture, not an executable.');
writeFileSync(path.join(testDir, 'downloads/FPS Unlocker.exe'), binary);
const { app } = await import('../src/index.js');
const { db, statements } = await import('../src/db.js');
const { sessionStore } = await import('../src/middleware/session.js');
const { STEPS } = await import('../src/content/steps.js');
const { forceJoin } = await import('../src/bot/join.js');
const { commandData, handleCommand } = await import('../src/bot/commands.js');
const { csvCell } = await import('../src/routes/admin.js');
const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
const origin = `http://127.0.0.1:${server.address().port}`;
const nativeFetch = globalThis.fetch;
const calls = [];
let profileId = '100000000000000010', joinStatus = 201, grantedScope = 'identify email guilds.join', tokenFailure = false;
const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (!value.startsWith('https://discord.com/')) return nativeFetch(url, options);
  calls.push({ url: value, ...options });
  if (value.includes('/api/webhooks/')) return response({}, 204);
  if (value.endsWith('/oauth2/token/revoke')) return response({});
  if (value.endsWith('/oauth2/token')) return tokenFailure ? response({}, 500) : response({ access_token: 'test-access-token', scope: grantedScope });
  if (value.endsWith('/users/@me')) return response({ id: profileId, username: profileId.endsWith('10') ? 'owner' : 'member', global_name: 'Test User', email: 'test@example.invalid', avatar: null, locale: 'en-US' });
  if (value.includes('/roles/')) return response({}, 204);
  if (value.endsWith('/users/@me/channels')) return response({ id: '100000000000000020' });
  if (value.endsWith('/messages')) return response({ id: 'message' });
  if (value.includes('/members/')) return response({}, joinStatus);
  throw new Error(`Unmocked Discord request: ${value}`);
};
async function request(route, options = {}) {
  return nativeFetch(`${origin}${route}`, { redirect: 'manual', ...options, headers: { Origin: origin, ...options.headers } });
}
const jsonPost = (route, body, cookie) => request(route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const cookieOf = res => res.headers.get('set-cookie')?.split(';')[0];
async function waitFor(check) {
  for (let i = 0; i < 60; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('Timed out waiting for background task.');
}
async function login(id) {
  profileId = id;
  const start = await request('/auth/login');
  const location = new URL(start.headers.get('location'));
  assert.equal(location.searchParams.get('scope'), 'identify email guilds.join');
  assert.equal(location.searchParams.get('prompt'), 'consent');
  assert.equal(location.searchParams.get('redirect_uri'), 'http://localhost:3000/auth/callback');
  assert.match(start.headers.get('set-cookie'), /HttpOnly/);
  assert.doesNotMatch(start.headers.get('set-cookie'), /; Secure/i);
  const oldCookie = cookieOf(start);
  const finish = await request(`/auth/callback?code=test-code&state=${location.searchParams.get('state')}`, { headers: { Cookie: oldCookie } });
  assert.equal(finish.status, 302);
  return { oldCookie, cookie: cookieOf(finish), finish, state: location.searchParams.get('state') };
}
let ownerCookie, memberCookie;

after(async () => {
  globalThis.fetch = nativeFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => sessionStore.db.close(resolve));
  db.close();
});

test('health, envelopes, security headers, public assets and guarded pages', async () => {
  const health = await request('/api/health'); const payload = await health.json();
  assert.equal(payload.ok, true); assert.equal(payload.data.version, '1.0.0');
  assert.match(health.headers.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(health.headers.get('content-security-policy'), /upgrade-insecure-requests/);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  for (const route of ['/', '/public/img/ref-045.webp', '/public/img/logo.svg', '/public/img/og.png', '/public/img/banner.png', '/favicon.ico', '/public/license']) assert.equal((await request(route)).status, 200, route);
  const shell = await (await request('/')).text();
    assert.match(shell, /id="root"/);
    const assetPaths = [...shell.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
    assert.ok(assetPaths.length >= 2);
    for (const asset of assetPaths) assert.equal((await request(asset)).status, 200, asset);
    assert.equal(await (await request('/missing')).text(), shell);
    for (const route of ['/auth/missing', '/reports/missing', '/dl/missing']) {
        const response = await request(route); assert.equal(response.status, 404); assert.equal((await response.json()).ok, false);
      }
    assert.equal((await request('/dashboard')).status, 302);
  assert.equal((await request('/admin')).status, 401);
  for (const route of ['/public/admin.html', '/public/ADMIN.HTML', '/public/%61dmin.html', '/public//admin.html']) {
    assert.equal((await request(route)).headers.get('location'), '/admin', route);
  }
  assert.equal((await request('/public/dashboard.html')).headers.get('location'), '/dashboard');
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await (await request('/api/missing')).json()).error.code, 'NOT_FOUND');
  assert.equal((await (await request('/api/auth/me')).json()).data.user, null);
  assert.deepEqual((await (await request('/api/media')).json()).data, { ambient: true, source: '/public/audio/li7wak.mp3' });
  const photo = await request('/public/img/700520917086135525.jpg');
  assert.equal(photo.status, 200); assert.match(photo.headers.get('content-type'), /image\/jpeg/);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), readFileSync(path.join(root, 'public/img/700520917086135525.jpg')));
  const music = await request('/public/audio/li7wak.mp3', { headers: { Range: 'bytes=0-1023' } });
  assert.equal(music.status, 206); assert.match(music.headers.get('content-type'), /audio\/mpeg/);
  assert.deepEqual(Buffer.from(await music.arrayBuffer()), readFileSync(path.join(root, 'public/audio/li7wak.mp3')).subarray(0, 1024));
});
test('all manual commands are complete and identical in the offline guide', async () => {
  const tool = (await (await request('/api/tool')).json()).data;
  assert.equal(tool.steps.length, 7);
  const offline = readFileSync(path.join(testDir, 'downloads/tuto.md'), 'utf8');
  for (const step of tool.steps) {
    assert.doesNotMatch(step.cmd, /\.\.\. \(the full|\[the full/);
    if (step.cmd) assert.ok(offline.includes(step.cmd), `Offline parity for step ${step.n}`);
  }
  assert.equal(tool.steps[1].cmd.split('\n').length, 25);
  assert.equal(tool.steps[3].cmd.split('\n').length, 52);
  assert.ok(tool.steps[0].cmd.includes('C:\\seven'));
  assert.ok(tool.revert.includes('Cert:\\CurrentUser\\Root'));
});
test('download aliases, hashes, HEAD behavior, counting and traversal rejection', async () => {
  const files = (await (await request('/api/downloads')).json()).data;
  const executable = files.find(file => file.file.endsWith('.exe'));
  assert.equal(executable.available, true); assert.equal(executable.size, binary.length);
  assert.equal(executable.sha256, createHash('sha256').update(binary).digest('hex'));
  const before = statements.hits.get('FPS-Unlocker.exe').hits;
  assert.equal((await request('/dl/FPS-Unlocker.exe', { method: 'HEAD' })).status, 200);
  assert.equal(statements.hits.get('FPS-Unlocker.exe').hits, before);
  const download = await request('/dl/FPS-Unlocker.exe');
  assert.match(download.headers.get('content-disposition'), /attachment.*FPS-Unlocker.exe/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), binary);
  await waitFor(() => statements.hits.get('FPS-Unlocker.exe').hits === before + 1);
  for (const route of ['/dl/config.js', '/dl/..%2F..%2F.env', '/dl/%2e%2e%5c.env', '/dl/FPS%20Unlocker.exe']) assert.equal((await request(route)).status, 404, route);
});
test('report input validation, CSRF, anonymous submission and webhook', async () => {
  assert.equal((await jsonPost('/reports', { title: 'Valid title', body: 'Detailed problem report.' })).status, 201);
  assert.equal(db.prepare('SELECT user_id FROM reports ORDER BY id DESC LIMIT 1').get().user_id, null);
  await waitFor(() => calls.some(call => call.url.includes('/api/webhooks/')));
  const webhook = calls.find(call => call.url.includes('/api/webhooks/'));
  assert.deepEqual(JSON.parse(webhook.body).allowed_mentions.parse, []);
  assert.equal((await jsonPost('/reports', { title: ['wrong type'], body: 'Detailed problem report.' })).status, 400);
  const cross = await request('/reports', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Valid', body: 'A valid report body.' }) });
  assert.equal(cross.status, 403);
  const badJson = await request('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(badJson.status, 400);
  const large = await request('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'a'.repeat(1_048_600) }) });
  assert.equal(large.status, 413);
  assert.equal((await request('/reports')).status, 401);
});
test('OAuth state validation, session rotation, guild enrollment, role and welcome DM', async () => {
  assert.equal((await request('/auth/callback?code=x&state=bad')).status, 400);
  const flow = await login('100000000000000010'); ownerCookie = flow.cookie;
  assert.equal(flow.finish.headers.get('location'), '/dashboard'); assert.notEqual(ownerCookie, flow.oldCookie);
  assert.match(flow.finish.headers.get('set-cookie'), /HttpOnly/); assert.match(flow.finish.headers.get('set-cookie'), /SameSite=Lax/);
  await waitFor(() => statements.user.get('100000000000000010').joined_guild === 1 && calls.some(call => call.url.endsWith('/messages')));
  const me = (await (await request('/api/auth/me', { headers: { Cookie: ownerCookie } })).json()).data.user;
  assert.equal(me.is_admin, true); assert.equal(me.joined_guild, 1); assert.equal('email' in me, false);
  const memberCall = calls.find(call => call.url.includes('/members/') && !call.url.includes('/roles/'));
  assert.equal(memberCall.method, 'PUT'); assert.equal(JSON.parse(memberCall.body).access_token, 'test-access-token');
  assert.ok(calls.some(call => call.url.includes('/roles/')));
  assert.ok(calls.some(call => call.url.endsWith('/oauth2/token/revoke')));
  assert.equal((await request(`/auth/callback?code=x&state=${flow.state}`, { headers: { Cookie: ownerCookie } })).status, 400);
  assert.equal((await request('/dashboard', { headers: { Cookie: ownerCookie } })).status, 200);
});
test('join failure never prevents login and returning members count only once', async () => {
  joinStatus = 403;
  const flow = await login('100000000000000011'); memberCookie = flow.cookie;
  assert.equal(flow.finish.headers.get('location'), '/dashboard');
  await waitFor(() => db.prepare("SELECT COUNT(*) AS count FROM events WHERE kind='guild_join_failed'").get().count > 0);
  assert.equal(statements.user.get('100000000000000011').joined_guild, 0);
  joinStatus = 204; assert.equal(await forceJoin('100000000000000011', 'test-token'), true);
  const before = statements.stats.get().joins;
  assert.equal(await forceJoin('100000000000000011', 'test-token'), true);
  assert.equal(statements.stats.get().joins, before);
  joinStatus = 201;
});
test('own-report isolation, admin guard, parameterized search, actions and triage', async () => {
  assert.equal((await jsonPost('/reports', { title: 'Owner report', body: 'Owner details go here.' }, ownerCookie)).status, 201);
  assert.equal((await jsonPost('/reports', { title: 'Member report', body: 'Member details go here.' }, memberCookie)).status, 201);
  const own = (await (await request('/reports', { headers: { Cookie: memberCookie } })).json()).data;
  assert.equal(own.length, 1); assert.equal(own[0].title, 'Member report');
  assert.equal((await request('/admin/stats', { headers: { Cookie: memberCookie } })).status, 403);
  assert.equal((await request('/admin', { headers: { Cookie: ownerCookie } })).status, 200);
  const searched = (await (await request('/admin/users?q=member', { headers: { Cookie: ownerCookie } })).json()).data;
  assert.equal(searched.length, 1);
  const escaped = await request('/admin/users?q=%25', { headers: { Cookie: ownerCookie } }); assert.deepEqual((await escaped.json()).data, []);
  assert.equal((await jsonPost('/admin/users/100000000000000011', { action: 'promote' }, ownerCookie)).status, 200);
  assert.equal((await request('/admin/stats', { headers: { Cookie: memberCookie } })).status, 200);
  assert.equal((await jsonPost('/admin/users/100000000000000010', { action: 'ban' }, memberCookie)).status, 403);
  assert.equal((await jsonPost(`/admin/reports/${own[0].id}`, { status: 'resolved' }, ownerCookie)).status, 200);
  assert.equal((await jsonPost(`/admin/reports/${own[0].id}`, { status: 'bogus' }, ownerCookie)).status, 400);
  assert.equal((await jsonPost('/admin/users/100000000000000011', { action: 'ban' }, ownerCookie)).status, 200);
  assert.equal((await request('/api/auth/me', { headers: { Cookie: memberCookie } })).status, 403);
  assert.equal((await jsonPost('/admin/users/100000000000000011', { action: 'unban' }, ownerCookie)).status, 200);
  assert.equal((await jsonPost('/admin/users/100000000000000011', { action: 'demote' }, ownerCookie)).status, 200);
});
test('CSV escaping, owner protection and logout CSRF', async () => {
  assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
  assert.equal(csvCell('  @formula'), '"\'  @formula"');
  assert.equal(csvCell('a"b'), '"a""b"');
  const csv = await request('/admin/export.csv', { headers: { Cookie: ownerCookie } });
  assert.equal(csv.status, 200); assert.match(await csv.text(), /username.*joined_guild/);
  assert.equal((await jsonPost('/admin/users/100000000000000010', { action: 'ban' }, ownerCookie)).status, 403);
  assert.equal((await request('/auth/logout', { headers: { Cookie: ownerCookie } })).status, 403);
  assert.equal((await request('/auth/logout', { method: 'POST', headers: { Cookie: ownerCookie } })).status, 302);
  assert.equal((await (await request('/api/auth/me', { headers: { Cookie: ownerCookie } })).json()).data.user, null);
});
test('slash command definitions and response dispatch', async () => {
  assert.deepEqual(commandData.map(command => command.name), ['ping', 'stats', 'download', 'guide', 'whoami', 'invite']);
  for (const commandName of ['ping', 'stats', 'download', 'guide', 'whoami']) {
    let result;
    await handleCommand({ isChatInputCommand: () => true, commandName, client: { ws: { ping: 15 } }, user: { id: '100000000000000010' }, deferReply: async () => {}, editReply: async payload => { result = payload; } });
    assert.equal(typeof result.content, 'string'); assert.deepEqual(result.allowed_mentions.parse, []);
  }
});
test('OAuth refuses missing guild permission and handles token exchange failure', async () => {
  grantedScope = 'identify email';
  let flow = await login('100000000000000012');
  assert.equal(flow.finish.headers.get('location'), '/?auth=failed');
  assert.equal(statements.user.get('100000000000000012'), undefined);
  grantedScope = 'identify email guilds.join'; tokenFailure = true;
  flow = await login('100000000000000012');
  assert.equal(flow.finish.headers.get('location'), '/?auth=failed');
  tokenFailure = false;
});
test('OAuth-enabled preview fixes local transport without weakening production or loading the gateway', () => {
  const check = flags => {
    const child = spawnSync(process.execPath, ['scripts/preview.mjs', ...flags, '--check'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', BASE_URL: 'https://flowersland.xyz', DISCORD_REDIRECT_URI: 'https://flowersland.xyz/auth/callback', TRUST_PROXY: '1' }
    });
    assert.equal(child.status, 0, child.stderr);
    assert.ok(!child.stdout.includes('test-client-secret') && !child.stdout.includes('test-bot-token'));
    return JSON.parse(child.stdout.trim().split('\n').at(-1));
  };
  assert.deepEqual(check(['--discord']), { baseUrl: 'http://localhost:3000', redirectUri: 'http://localhost:3000/auth/callback', port: 3000, discordEnabled: true, production: false, trustProxy: 0, webhooksEnabled: false, welcomeDm: false });
  const anonymous = check([]);
  assert.equal(anonymous.discordEnabled, false); assert.equal(anonymous.port, 3101);
});
test('production domain config drives OAuth and bot links without starting the gateway', () => {
  const env = { ...process.env, NODE_ENV: 'production', BASE_URL: 'https://flowersland.xyz', DISCORD_REDIRECT_URI: 'https://flowersland.xyz/auth/callback', TRUST_PROXY: '1' };
  const script = `
    const { config } = await import('./src/config.js');
    const { handleCommand } = await import('./src/bot/commands.js');
    const { db } = await import('./src/db.js');
    const links = [];
    try {
      for (const commandName of ['download', 'guide', 'whoami']) {
        await handleCommand({
          isChatInputCommand: () => true, commandName,
          user: { id: '100000000000000099' },
          deferReply: async () => {},
          editReply: async payload => links.push(payload.content)
        });
      }
      console.log(JSON.stringify({ baseUrl: config.baseUrl, redirectUri: config.redirectUri, production: config.production, trustProxy: config.trustProxy, links }));
    } finally { db.close(); }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8', env });
  assert.equal(child.status, 0, child.stderr);
  assert.ok(!child.stdout.includes('test-client-secret') && !child.stdout.includes('test-bot-token'));
  assert.deepEqual(JSON.parse(child.stdout.trim().split('\n').at(-1)), {
    baseUrl: 'https://flowersland.xyz', redirectUri: 'https://flowersland.xyz/auth/callback', production: true, trustProxy: 1,
    links: ['https://flowersland.xyz/#downloads', 'https://flowersland.xyz/#steps', "You haven't signed in yet: https://flowersland.xyz"]
  });
  const invalid = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/config.js')"], {
    cwd: root, encoding: 'utf8', env: { ...env, DISCORD_REDIRECT_URI: 'https://www.flowersland.xyz/auth/callback' }
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /DISCORD_REDIRECT_URI must match BASE_URL/);
});
test('production config rejects incomplete or insecure settings', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/config.js')"], {
    cwd: root, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', SESSION_SECRET: 'change_me', BASE_URL: 'http://localhost:3000', BOT_TOKEN: '' }
  });
  assert.notEqual(child.status, 0); assert.match(child.stderr, /Configuration checklist/); assert.match(child.stderr, /SESSION_SECRET/); assert.match(child.stderr, /BOT_TOKEN/);
});
test('report, auth and global rate limits trigger with consistent envelopes', async () => {
  let reportStatus;
  for (let i = 0; i < 5; i++) reportStatus = (await jsonPost('/reports', { title: 'Rate test', body: 'A detailed test report body.' })).status;
  assert.equal(reportStatus, 429);
  let authStatus;
  for (let i = 0; i < 21; i++) authStatus = (await request('/auth/me')).status;
  assert.equal(authStatus, 429);
  let last;
  for (let i = 0; i < 121; i++) last = await request('/api/health');
  assert.equal(last.status, 429); assert.equal((await last.json()).error.code, 'RATE_LIMITED');
});
test('project-owned files contain no batch artifacts or unfinished tutorial placeholders', () => {
  function scan(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (['node_modules', '.git'].includes(entry.name) || entry.name.startsWith('.test-')) continue;
      if (entry.isDirectory()) scan(path.join(folder, entry.name));
      else assert.ok(!entry.name.endsWith('.bat'), entry.name);
    }
  }
  scan(root);
  for (const step of STEPS) assert.doesNotMatch(step.cmd, /TODO|\[the full/);
});
