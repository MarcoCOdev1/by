import { test, expect } from '@playwright/test';

test('development uses one origin with nonce CSP, styled React and a connected HMR socket', async ({ page }) => {
  const errors = [], connections = [], frames = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('websocket', socket => {
    connections.push(socket.url());
    socket.on('framereceived', frame => frames.push(String(frame.payload)));
  });
  const response = await page.goto('/');
  const csp = response.headers()['content-security-policy'];
  const html = await response.text();
  const nonce = html.match(/<script nonce="([^"]+)"/)[1];
  expect(csp).toContain(`'nonce-${nonce}'`);
  expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  expect(html).toContain('/@vite/client');
  await expect(page.getByRole('heading', { name: /^Your FPS\.\s+Your rules\.\s*●$/ })).toBeVisible();
  await expect.poll(() => frames.some(frame => frame.includes('"type":"connected"'))).toBe(true);
  expect(connections).toHaveLength(1);
  const socket = new URL(connections[0]);
  expect(socket.host).toBe('localhost:3103');
  expect(socket.pathname).toBe('/vite-hmr');
  await expect(page.locator('.hero-photo')).toHaveAttribute('src', '/public/img/700520917086135525.jpg');
  await expect.poll(() => page.locator('.hero-photo').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.hero-art-frame, .ascii-art')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  expect((await (await page.request.get('/api/auth/me')).json()).data.discordEnabled).toBe(false);
  expect(errors).toEqual([]);
});
