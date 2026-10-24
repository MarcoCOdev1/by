import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = process.env;
const production = env.NODE_ENV === 'production';
const port = Number(env.PORT || 3000);
const baseUrl = env.BASE_URL || `http://localhost:${port}`;
const discordKeys = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'BOT_TOKEN', 'GUILD_ID'];
const missing = discordKeys.filter(key => !env[key]);
const problems = [];
if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('PORT must be between 1 and 65535');
let origin;
try {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
  if (production && url.protocol !== 'https:') throw new Error();
  origin = url.origin;
} catch { problems.push('BASE_URL must be an origin (HTTPS in production), without a path'); }
if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.startsWith('change_me'))) {
  problems.push('SESSION_SECRET must be a unique random secret with at least 32 characters');
}
if (production && missing.length) problems.push(...missing.map(key => `${key} is required for Discord`));
for (const key of ['DISCORD_CLIENT_ID', 'GUILD_ID', 'WELCOME_ROLE_ID']) {
  if (env[key] && !/^\d{17,20}$/.test(env[key])) problems.push(`${key} must be a Discord snowflake`);
}
const adminIds = (env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
if (adminIds.some(x => !/^\d{17,20}$/.test(x))) problems.push('ADMIN_IDS must be comma-separated Discord snowflakes');
const trustProxy = Number(env.TRUST_PROXY ?? (production ? 1 : 0));
if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) problems.push('TRUST_PROXY must be a hop count from 0 to 5');
const redirectUri = env.DISCORD_REDIRECT_URI || `${origin}/auth/callback`;
try {
  const url = new URL(redirectUri);
  if (url.origin !== origin || url.pathname !== '/auth/callback' || url.search || url.hash) throw new Error();
} catch { problems.push('DISCORD_REDIRECT_URI must match BASE_URL + /auth/callback'); }
if (env.DISCORD_WEBHOOK_URL && !/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(env.DISCORD_WEBHOOK_URL)) {
  problems.push('DISCORD_WEBHOOK_URL must be a Discord HTTPS webhook URL');
}
if (problems.length) throw new Error(`Configuration checklist:\n${problems.map(p => `  [ ] ${p}`).join('\n')}`);
if (!production && missing.length && env.NODE_ENV !== 'test') {
  console.warn(`Discord disabled until configured:\n${missing.map(key => `  [ ] ${key}`).join('\n')}`);
}
if (!env.SESSION_SECRET && env.NODE_ENV !== 'test') console.warn('Development session secret is ephemeral; set SESSION_SECRET to preserve sessions across restarts.');

export const config = Object.freeze({
  root, production, port, baseUrl: origin, redirectUri, trustProxy,
  sessionSecret: env.SESSION_SECRET || randomBytes(48).toString('hex'),
  dataDir: path.resolve(root, env.DATA_DIR || 'data'),
  logDir: path.resolve(root, env.LOG_DIR || 'logs'),
  discordEnabled: missing.length === 0,
  clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET,
  botToken: env.BOT_TOKEN, guildId: env.GUILD_ID, welcomeRoleId: env.WELCOME_ROLE_ID,
  webhookUrl: env.DISCORD_WEBHOOK_URL, welcomeDm: env.WELCOME_DM === 'true',
  memberIntent: env.GUILD_MEMBERS_INTENT === 'true', adminIds,
  version: '1.0.0'
});
