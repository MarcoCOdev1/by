// Compiled local preview. Real OAuth is opt-in; neither mode starts the bot gateway.
import { randomBytes } from 'node:crypto';
const discord = process.argv.includes('--discord');
if (discord) {
  await import('dotenv/config');
  // Override local transport only in this process; preserve .env and production security.
  Object.assign(process.env, { NODE_ENV: 'development', PORT: '3000', BASE_URL: 'http://localhost:3000', DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/callback', TRUST_PROXY: '0', DISCORD_WEBHOOK_URL: '', WELCOME_DM: 'false' });
} else {
  Object.assign(process.env, { NODE_ENV: 'development', DOTENV_CONFIG_PATH: './data/.no-preview-env', PORT: '3101', BASE_URL: 'http://localhost:3101', DISCORD_REDIRECT_URI: 'http://localhost:3101/auth/callback', SESSION_SECRET: randomBytes(48).toString('hex'), TRUST_PROXY: '0', DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '', BOT_TOKEN: '', GUILD_ID: '', WELCOME_ROLE_ID: '', DISCORD_WEBHOOK_URL: '', ADMIN_IDS: '', DATA_DIR: 'data', LOG_DIR: 'logs' });
}
const { config } = await import('../src/config.js');
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ baseUrl: config.baseUrl, redirectUri: config.redirectUri, port: config.port, discordEnabled: config.discordEnabled, production: config.production, trustProxy: config.trustProxy, webhooksEnabled: Boolean(config.webhookUrl), welcomeDm: config.welcomeDm }));
} else {
  const { httpServer } = await import('../src/index.js');
  const { closeFrontend } = await import('../src/util/frontend.js');
  const { sessionStore } = await import('../src/middleware/session.js');
  const { db } = await import('../src/db.js');
  const server = httpServer.listen(config.port, '127.0.0.1', () => {
    console.log(`${discord ? 'Discord-enabled' : 'Credential-free'} BYPASSER preview: ${config.baseUrl}`);
    if (discord) console.log(`Register this OAuth2 redirect in Discord: ${config.redirectUri}`);
  });
  server.on('error', error => { console.error(`Preview failed: ${error.message}`); process.exit(1); });
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    void closeFrontend();
    server.closeAllConnections();
    server.close(() => sessionStore.db.close(() => { db.close(); process.exit(0); }));
  };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
