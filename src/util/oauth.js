import { config } from '../config.js';
const API = 'https://discord.com/api/v10';

export async function discordFetch(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, { ...options, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    // Never propagate Discord's response body: it can contain sensitive data.
    const error = new Error(`Discord request failed (${response.status})`);
    error.discordStatus = response.status;
    throw error;
  }
  return response;
}
export async function exchangeCode(code) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
    grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
  const response = await discordFetch('/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json();
  if (typeof data.access_token !== 'string') throw new Error('Discord returned an invalid access token.');
  if (typeof data.scope !== 'string' || !data.scope.split(' ').includes('guilds.join')) {
    await revokeToken(data.access_token);
    throw new Error('Discord did not grant the required guild enrollment permission.');
  }
  return data.access_token;
}
export async function fetchProfile(accessToken) {
  return (await discordFetch('/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } })).json();
}
// Tokens are held only in memory for the initial enrollment, not in sessions or SQLite.
export async function revokeToken(accessToken) {
  try {
    await discordFetch('/oauth2/token/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, token: accessToken, token_type_hint: 'access_token' }) });
  } catch { /* Revocation failure must not disrupt login or expose a token. */ }
}
