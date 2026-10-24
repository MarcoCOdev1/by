import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = 'data/.test-browser-evidence';
mkdirSync(evidence, { recursive: true });
test.beforeEach(async ({ request }) => {
  expect((await request.post('/__test/reset-rate-limits')).status()).toBe(204);
});
const canvasHash = locator => locator.evaluate(c => c.toDataURL());
// Windows clipboard text uses CRLF; compare all command content without trimming.
const lineEndings = text => text.replace(/\r\n/g, '\n');
const clipboardText = page => page.evaluate(() => navigator.clipboard.readText()).then(lineEndings);
const textContrast = locator => locator.evaluate(element => {
  const style = getComputedStyle(element);
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const foreground = luminance(style.color), background = luminance(style.backgroundColor);
  return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
});
async function artworkReady(page) {
  await page.evaluate(() => document.fonts.ready);
  const photo = page.locator('.hero-photo');
  await expect(photo).toHaveAttribute('src', '/public/img/700520917086135525.jpg');
  await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await photo.evaluate(img => ({ border: getComputedStyle(img).borderTopWidth, shadow: getComputedStyle(img).boxShadow, radius: getComputedStyle(img).borderRadius }))).toEqual({ border: '0px', shadow: 'none', radius: '0px' });
  await expect(page.locator('.hero-art-frame, .ascii-art, .art-caption, .art-corner, .art-side-label')).toHaveCount(0);
}
test('desktop artwork, exact screenshots, all command copies, consent, audio and reporting', async ({ page, context }) => {
  const errors = [], badNetwork = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); }); page.on('response', r => { if (r.status() >= 500) badNetwork.push(`${r.status()} ${r.url()}`); });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript(() => {
    window.testAudioTracks = [];
    window.Audio = new Proxy(window.Audio, { construct(target, args) { const track = new target(...args); window.testAudioTracks.push(track); return track; } });
  });
  await page.goto('/'); await artworkReady(page);
  expect(await textContrast(page.getByRole('link', { name: 'Explore the guide' }))).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(() => window.testAudioTracks.length)).toBe(0);
  expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([1440, 900]);
  const voxels = page.locator('.voxel-arc');
  await voxels.scrollIntoViewIfNeeded();
  const v = await canvasHash(voxels); await page.waitForTimeout(350); expect(await canvasHash(voxels)).not.toBe(v);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const pausedVoxel = await canvasHash(voxels); await page.waitForTimeout(400); expect(await canvasHash(voxels)).toBe(pausedVoxel);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${evidence}/desktop-dark.png` });
  await page.getByRole('button', { name: 'Switch to light theme' }).click(); await page.screenshot({ path: `${evidence}/desktop-light.png` });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click(); await page.getByRole('button', { name: 'Resume animation' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await voxels.scrollIntoViewIfNeeded(); await expect.poll(() => canvasHash(voxels)).not.toBe(pausedVoxel);
  const tool = (await (await page.request.get('/api/tool')).json()).data;
  const commands = tool.steps.filter(s => s.cmd).map(s => [`Copy step ${s.n} / powershell command`, s.cmd]);
  commands.push(['Copy verify / powershell command', tool.verify], ['Copy revert / admin powershell command', tool.revert]);
  for (const [name, command] of commands) { await page.getByRole('button', { name, exact: true }).click(); await expect.poll(() => clipboardText(page)).toBe(lineEndings(command)); }
  for (const key of ['payload', 'request']) {
    const detail = page.locator('.reference-list details').filter({ has: page.locator('summary', { hasText: key === 'payload' ? 'Token payload' : 'Request body' }) });
    await detail.locator('summary').click(); await detail.getByRole('button', { name: `Copy ${key} / json reference command`, exact: true }).click();
    await expect.poll(() => clipboardText(page)).toBe(lineEndings(tool.reference[key]));
  }
  await page.getByRole('tab', { name: /02 Respond/ }).click(); await expect(page.getByRole('tabpanel')).toContainText('A local HTTPS response.');
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: /03 Construct/ })).toBeFocused();
  await page.getByRole('button', { name: 'Connect', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('permission to join our Discord server automatically'); await page.getByRole('button', { name: 'Not now' }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Play ambient music', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient music', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => { const track = window.testAudioTracks[0]; return { source: new URL(track.src).pathname, loop: track.loop, paused: track.paused, ready: track.readyState >= 2 }; })).toEqual({ source: '/public/audio/li7wak.mp3', loop: true, paused: false, ready: true });
  await expect.poll(() => page.evaluate(() => window.testAudioTracks[0].currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute ambient music from record', exact: true }).click();
  expect(await page.evaluate(() => window.testAudioTracks[0].paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Play ambient music', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Play ambient music from record', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient music', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.testAudioTracks.length)).toBe(1);
  await page.getByRole('button', { name: 'Mute ambient music', exact: true }).click();
  expect(await page.evaluate(() => window.testAudioTracks[0].paused)).toBe(true);
  await page.getByLabel('Report title', { exact: true }).fill('Browser acceptance report'); await page.getByLabel('Details', { exact: true }).fill('Isolated browser fixture submitted during frontend acceptance.'); await page.getByRole('button', { name: 'Send report' }).click(); await expect(page.locator('.form-status')).toContainText('saved');
  await page.locator('#support').scrollIntoViewIfNeeded(); const offscreenVoxel = await canvasHash(voxels); await page.waitForTimeout(300); expect(await canvasHash(voxels)).toBe(offscreenVoxel);
  expect(errors).toEqual([]); expect(badNetwork).toEqual([]);
});
test('actual 360px layout, mobile nav and light/dark screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await page.goto('/'); await artworkReady(page);
  expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([360, 800]);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await page.screenshot({ path: `${evidence}/mobile-dark.png` }); await page.getByRole('button', { name: 'Switch to light theme' }).click(); await page.screenshot({ path: `${evidence}/mobile-light.png` });
  await page.getByRole('button', { name: 'Toggle navigation' }).click(); await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Guide' }).click(); await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  for (const id of ['hero', 'how', 'steps', 'verify', 'downloads', 'reference', 'fixes', 'support', 'community', 'credits']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), id).toBe(true);
  }
  await page.locator('#support').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${evidence}/mobile-support.png` });
});
test('reduced motion renders visible static artwork, suppresses CSS and keeps accessible controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await artworkReady(page);
  const voxels = page.locator('.voxel-arc'); await voxels.scrollIntoViewIfNeeded();
  const initial = await canvasHash(voxels); await page.waitForTimeout(400); expect(await canvasHash(voxels)).toBe(initial);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByRole('button', { name: 'Resume animation', exact: true })).toBeDisabled();
  expect(await page.locator('.orbit').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-active', 'false');
  const ribbon = page.locator('.ribbon-primary'), frozen = await ribbon.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(300); expect(await ribbon.evaluate(el => getComputedStyle(el).transform)).toBe(frozen);
  await page.screenshot({ path: `${evidence}/reduced-motion.png` });
});
test('server guards, 404, own-report dashboard and enrollment polling', async ({ page, context }) => {
  await page.goto('/dashboard'); await expect(page).toHaveURL(/auth=required/);
  expect((await page.request.get('/admin')).status()).toBe(401); expect((await page.request.get('/api/missing')).status()).toBe(404);
  const missing = await page.goto('/no-such-page'); expect(missing.status()).toBe(404); await expect(page.getByRole('heading', { name: 'This page went off-script.' })).toBeVisible();
  await page.goto('/__test/login/member'); await expect(page.getByRole('heading', { name: 'Preview Member' })).toBeVisible(); await expect(page.getByText('Waiting for confirmation.', { exact: true })).toBeVisible(); await expect(page.getByText('#1 · Member-only fixture')).toBeVisible(); await expect(page.getByText(/Browser acceptance report/)).toHaveCount(0);
  await context.request.get('/__test/confirm-enrollment'); await expect(page.getByText('Your place is confirmed.', { exact: true })).toBeVisible({ timeout: 7000 });
  await page.screenshot({ path: `${evidence}/dashboard.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/mobile-dashboard.png` });
});
test('admin search, pagination, moderation, triage, CSV and logout with test identities', async ({ page }) => {
  // Create this test's own report instead of depending on another test succeeding.
  const seeded = await page.request.post('/reports', { headers: { Origin: 'http://localhost:3103' }, data: { title: 'Admin triage fixture', body: 'Independent isolated report for browser admin acceptance.' } });
  expect(seeded.status()).toBe(201);
  await page.goto('/__test/login/owner'); await expect(page.getByRole('heading', { name: 'The bigger picture.' })).toBeVisible();
  await expect(page.locator('.admin-stats .card').first()).toContainText('104');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.getByText('Page 2', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByLabel('Search users').fill('fixture-12'); await page.getByRole('button', { name: 'Search', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Fixture 12' }); await expect(row).toBeVisible();
  page.on('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: 'Ban', exact: true }).click(); await expect(row).toContainText('BANNED'); await row.getByRole('button', { name: 'Unban', exact: true }).click(); await expect(row).toContainText('JOINED');
  await row.getByRole('button', { name: 'Promote', exact: true }).click(); await expect(row).toContainText('ADMIN'); await row.getByRole('button', { name: 'Demote', exact: true }).click(); await expect(row).toContainText('JOINED');
  const reports = (await (await page.request.get('/admin/reports')).json()).data;
  const report = reports.find(r => r.title === 'Admin triage fixture'); expect(report).toBeTruthy();
  await page.getByLabel(`Status for report ${report.id}`).selectOption('resolved'); await expect(page.getByLabel(`Status for report ${report.id}`)).toHaveValue('resolved');
  await page.getByLabel('Filter reports').selectOption('resolved'); await expect(page.getByRole('heading', { name: new RegExp('Admin triage fixture') })).toBeVisible(); await expect(page.getByText('#1 · Member-only fixture')).toHaveCount(0);
  const csv = await page.request.get('/admin/export.csv'); expect(csv.status()).toBe(200); expect(await csv.text()).toContain('username');
  await expect(page.locator('.event-list')).toContainText('admin_user_action'); await page.screenshot({ path: `${evidence}/admin.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  for (const section of await page.locator('.admin-section').all()) {
    await section.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${evidence}/mobile-admin.png` });
  await page.getByLabel('Account menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL('/'); expect((await (await page.request.get('/api/auth/me')).json()).data.user).toBeNull();
});
test('local fonts, gradient glass surfaces, and background pause/resume', async ({ page }) => {
  await page.goto('/'); await artworkReady(page);
  const fonts = await page.evaluate(async () => {
    const families = ['WANARASETA', 'Casa Sol Display', 'Casa Sol Script', 'Flower Frame'];
    return Promise.all(families.map(async family => ({ family, loaded: (await document.fonts.load(`24px "${family}"`, 'aBYPASSER')).length > 0 })));
  });
  expect(fonts.every(font => font.loaded)).toBe(true);
  expect(await page.locator('.hero h1').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Casa Sol Display');
  expect(await page.locator('.hero .serif').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Casa Sol Script');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)).toContain('WANARASETA');
  expect(await page.locator('pre code').first().evaluate(el => getComputedStyle(el).fontFamily)).toContain('Consolas');
  await expect(page.locator('.ambient-background')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('.ambient-background').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  const ribbon = page.locator('.ribbon-primary'), transform = () => ribbon.evaluate(el => getComputedStyle(el).transform);
  const moving = await transform(); await page.waitForTimeout(300); expect(await transform()).not.toBe(moving);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-active', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect.poll(() => ribbon.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const paused = await transform(); await page.waitForTimeout(300); expect(await transform()).toBe(paused);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Switch to light theme' }).click();
    const panel = await page.locator('.step-panel').evaluate(el => ({ background: getComputedStyle(el).backgroundImage, blur: getComputedStyle(el).backdropFilter }));
    expect(panel.background).toContain('linear-gradient'); expect(panel.blur).toContain('blur(');
    await page.locator('#how').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${evidence}/glass-${theme}.png` });
  }
  await page.getByRole('button', { name: 'Resume animation', exact: true }).click();
  const resumed = await transform(); await page.waitForTimeout(300); expect(await transform()).not.toBe(resumed);
  for (const width of [1024, 768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const heading = await page.locator('.hero-copy').evaluate(el => ({
      right: el.getBoundingClientRect().right,
      scriptRight: el.querySelector('.serif').getBoundingClientRect().right
    }));
    expect(heading.scriptRight, `${width}px script stays inside its column`).toBeLessThanOrEqual(heading.right);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px page width`).toBe(true);
    await page.screenshot({ path: `${evidence}/typography-${width}.png` });
  }
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await page.locator('#community').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/mobile-community.png` });
  await page.locator('.sleeve-fan').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/mobile-credits.png` });
});
