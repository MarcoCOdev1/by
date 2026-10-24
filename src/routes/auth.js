import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { publicUser, statements } from '../db.js';
import { apiError, asyncRoute, recordEvent, sameOrigin } from '../util/events.js';
import { exchangeCode, fetchProfile, revokeToken } from '../util/oauth.js';
import { forceJoin } from '../bot/join.js';
import { logger } from '../logger.js';

export const authRouter = Router();
authRouter.get('/login', asyncRoute(async (req, res) => {
  if (!config.discordEnabled) return res.redirect('/?auth=unconfigured');
  const state = randomBytes(32).toString('hex');
  req.session.oauth = { state, created: Date.now() };
  await promisify(req.session.save).call(req.session);
  const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: 'code', scope: 'identify email guilds.join', state, prompt: 'consent' });
  res.redirect(`https://discord.com/oauth2/authorize?${query}`);
}));
authRouter.get('/callback', asyncRoute(async (req, res) => {
  const stored = req.session.oauth;
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  delete req.session.oauth;
  await promisify(req.session.save).call(req.session);
  if (!stored || Date.now() - stored.created > 10 * 60_000 || !/^[a-f0-9]{64}$/.test(state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(stored.state))) {
    return apiError(res, 400, 'OAUTH_STATE', 'Invalid or expired OAuth state. Start login again.');
  }
  if (req.query.error) return res.redirect('/?auth=cancelled');
  if (!config.discordEnabled || typeof req.query.code !== 'string' || req.query.code.length > 512) return apiError(res, 400, 'OAUTH_CODE', 'Missing OAuth authorization code.');
  let token;
  try {
    token = await exchangeCode(req.query.code);
    const profile = await fetchProfile(token);
    if (!/^\d{17,20}$/.test(profile.id) || typeof profile.username !== 'string') throw new Error('Invalid Discord profile.');
    if (statements.user.get(profile.id)?.banned) { await revokeToken(token); return apiError(res, 403, 'BANNED', 'This account has been banned.'); }
    statements.upsert.run({ id: profile.id, username: profile.username, global_name: profile.global_name || null,
      avatar: profile.avatar || null, email: profile.email || null, locale: profile.locale || null });
    // Rotate the session identifier before attaching the authenticated user.
    await promisify(req.session.regenerate).call(req.session);
    req.session.uid = profile.id;
    await promisify(req.session.save).call(req.session);
    recordEvent('login', { userId: profile.id });
    // Enrollment failures do not prevent login. The dashboard polls the stored result.
    void forceJoin(profile.id, token).finally(() => revokeToken(token)).catch(error => logger.warn({ message: error.message }, 'Enrollment background task failed'));
    res.redirect('/dashboard');
  } catch (error) {
    if (token) void revokeToken(token);
    logger.warn({ message: error.message }, 'Discord OAuth failed');
    res.redirect('/?auth=failed');
  }
}));
authRouter.get('/me', (req, res) => res.json({ ok: true, data: { user: publicUser(req.user), discordEnabled: config.discordEnabled } }));
const logout = (req, res, next) => req.session.destroy(error => {
  if (error) return next(error);
  res.clearCookie('bypasser.sid', { httpOnly: true, sameSite: 'lax', secure: config.production });
  res.redirect('/');
});
authRouter.post('/logout', sameOrigin, logout);
authRouter.get('/logout', (req, res, next) => {
  // Retain the specified GET endpoint without accepting cross-site logout navigations.
  if (req.get('sec-fetch-site') !== 'same-origin') return apiError(res, 403, 'CSRF', 'Use the sign-out button on the site.');
  logout(req, res, next);
});
