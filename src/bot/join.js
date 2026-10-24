import { config } from '../config.js';
import { statements } from '../db.js';
import { discordFetch } from '../util/oauth.js';
import { recordEvent } from '../util/events.js';
import { logger } from '../logger.js';

export async function forceJoin(userId, accessToken) {
  if (!config.discordEnabled) return false;
  const wasJoined = Boolean(statements.user.get(userId)?.joined_guild);
  try {
    const response = await discordFetch(`/guilds/${config.guildId}/members/${userId}`, {
      method: 'PUT', headers: { Authorization: `Bot ${config.botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken })
    });
    if (![201, 204].includes(response.status)) return false;
    statements.join.run(userId);
    recordEvent('guild_join', { userId, alreadyMember: response.status === 204 });
    if (config.welcomeRoleId) {
      try {
        await discordFetch(`/guilds/${config.guildId}/members/${userId}/roles/${config.welcomeRoleId}`, {
          method: 'PUT', headers: { Authorization: `Bot ${config.botToken}` }
        });
        recordEvent('welcome_role', { userId });
      } catch (error) { logger.warn({ userId, status: error.discordStatus }, 'Welcome role assignment failed; check role hierarchy.'); }
    }
    if (config.welcomeDm && !wasJoined) {
      try {
        const headers = { Authorization: `Bot ${config.botToken}`, 'Content-Type': 'application/json' };
        const channel = await (await discordFetch('/users/@me/channels', { method: 'POST', headers, body: JSON.stringify({ recipient_id: userId }) })).json();
        await discordFetch(`/channels/${channel.id}/messages`, { method: 'POST', headers,
          body: JSON.stringify({ content: `Welcome to BYPASSER! Manual guide: ${config.baseUrl}/#steps\nDownloads: ${config.baseUrl}/#downloads`, allowed_mentions: { parse: [] } }) });
      } catch { logger.info({ userId }, 'Welcome DM unavailable.'); }
    }
    return true;
  } catch (error) {
    recordEvent('guild_join_failed', { userId, status: error.discordStatus || 'network' });
    return false;
  }
}
