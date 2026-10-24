import { it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, useApp } from './lib/context.jsx';
import { CodeBlock } from './components/ui.jsx';
import { Layout, Navigation } from './components/Layout.jsx';
import { ReportForm } from './components/ReportForm.jsx';
import { HowItWorks } from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
const owner = { id: '100000000000000010', username: 'owner', global_name: 'Owner', joined_guild: 1, is_admin: true };
function mockApi(user = null, extra = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    const key = String(url).split('?')[0]; const data = key === '/api/auth/me' ? { user, discordEnabled: false } : extra[key];
    return { ok: true, status: 200, json: async () => ({ ok: true, data: typeof data === 'function' ? data(options) : data ?? [] }) };
  });
}
function wrap(node) { return render(<MemoryRouter><AppProvider>{node}</AppProvider></MemoryRouter>); }
it('copies the exact multiline command and announces feedback', async () => {
  mockApi(); const writeText = vi.fn(async () => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } }); Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  const command = 'cd C:\\seven\npython fake.py'; wrap(<CodeBlock command={command} label="STEP 6 / POWERSHELL" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy step 6 / powershell command' })); await waitFor(() => expect(writeText).toHaveBeenCalledWith(command)); expect(await screen.findByText('Copied')).toBeInTheDocument();
});
it('switches explanatory panels with pointer and arrow keys', async () => {
  mockApi(); wrap(<HowItWorks />); const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: /02 Respond/ })); expect(screen.getByRole('tabpanel')).toHaveTextContent('A local HTTPS response.');
  await user.keyboard('{ArrowRight}'); expect(screen.getByRole('tab', { name: /03 Construct/ })).toHaveFocus(); expect(screen.getByRole('tabpanel')).toHaveTextContent('Understand the token.');
  await user.keyboard('{End}'); expect(screen.getByRole('tab', { name: /04 Trust/ })).toHaveAttribute('aria-selected', 'true');
});
it('persists theme, pauses animation, and shows the authenticated menu', async () => {
  mockApi(owner); wrap(<Navigation />); await screen.findByRole('link', { name: 'Dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' })); expect(document.documentElement.dataset.theme).toBe('light'); expect(localStorage.getItem('bypasser.theme')).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: 'Pause animation' })); expect(document.documentElement.dataset.motion).toBe('off'); expect(screen.getByRole('button', { name: 'Resume animation' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: 'Admin console' })).toBeInTheDocument();
});
it('pauses the gradient background in hidden tabs and preserves manual pause on return', async () => {
  mockApi(); let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const { container } = wrap(<Layout />), background = container.querySelector('.ambient-background');
  await screen.findByRole('button', { name: 'Connect', exact: true });
  expect(background).toHaveAttribute('data-active', 'true');
  expect(background).toHaveAttribute('aria-hidden', 'true');
  hidden = true; fireEvent(document, new Event('visibilitychange'));
  expect(background).toHaveAttribute('data-active', 'false');
  hidden = false; fireEvent(document, new Event('visibilitychange'));
  expect(background).toHaveAttribute('data-active', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }));
  hidden = true; fireEvent(document, new Event('visibilitychange'));
  hidden = false; fireEvent(document, new Event('visibilitychange'));
  expect(background).toHaveAttribute('data-active', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Resume animation' }));
  expect(background).toHaveAttribute('data-active', 'true');
});
it('posts sign-out with same-origin credentials, refreshes the account, and retains the menu on failure', async () => {
  let user = owner, failed = true;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (url === '/auth/logout') {
      if (failed) return { ok: false, json: async () => ({ error: { message: 'Sign-out temporarily unavailable.' } }) };
      user = null;
      return { ok: true };
    }
    return { ok: true, json: async () => ({ ok: true, data: { user, discordEnabled: false } }) };
  });
  wrap(<Navigation />); await screen.findByRole('link', { name: 'Dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Sign-out temporarily unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  failed = false; fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument();
  expect(fetch.mock.calls.find(([url]) => url === '/auth/logout')[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
});
it('opens consent state for anonymous Discord actions', async () => {
  mockApi(); function State() { const { loginOpen } = useApp(); return <span>{loginOpen ? 'Disclosure opened' : 'Disclosure closed'}</span>; }
  wrap(<><Navigation /><State /></>); fireEvent.click(screen.getByRole('button', { name: 'Connect' })); expect(screen.getByText('Disclosure opened')).toBeInTheDocument();
});
it('plays only the supplied MP3 after a click and shares pause/resume across music controls', async () => {
  mockApi(); const track = { play: vi.fn(async () => {}), pause: vi.fn() };
  const Audio = vi.spyOn(globalThis, 'Audio').mockImplementation(function () { return track; });
  function Record() { const { toggleAudio, playing } = useApp(); return <button onClick={toggleAudio} aria-pressed={playing}>Record music</button>; }
  const { unmount } = wrap(<><Navigation /><Record /></>);
  await screen.findByRole('button', { name: 'Connect', exact: true });
  expect(Audio).not.toHaveBeenCalled(); expect(track.play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play ambient music', exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record music' })).toHaveAttribute('aria-pressed', 'true'));
  expect(Audio).toHaveBeenCalledWith('/public/audio/li7wak.mp3'); expect(track).toMatchObject({ loop: true, volume: .15, preload: 'none' });
  fireEvent.click(screen.getByRole('button', { name: 'Record music' })); expect(track.pause).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Play ambient music', exact: true })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Record music' }));
  await waitFor(() => expect(track.play).toHaveBeenCalledTimes(2)); expect(Audio).toHaveBeenCalledTimes(1);
  unmount(); expect(track.pause).toHaveBeenCalledTimes(2);
});
it('reports MP3 playback errors without pretending music is playing and allows retry', async () => {
  mockApi(); const track = { play: vi.fn().mockRejectedValueOnce(new Error('Decode failed')).mockResolvedValue(undefined), pause: vi.fn() };
  vi.spyOn(globalThis, 'Audio').mockImplementation(function () { return track; });
  wrap(<Navigation />); await screen.findByRole('button', { name: 'Connect', exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Play ambient music', exact: true }));
  expect(await screen.findByText('Music could not play. Check li7wak.mp3 and try again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play ambient music', exact: true })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Play ambient music', exact: true }));
  expect(await screen.findByRole('button', { name: 'Mute ambient music', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
it('sends the report to the existing endpoint and resets only on success', async () => {
  const fetch = mockApi(null, { '/reports': { id: 42 } }); wrap(<ReportForm />);
  fireEvent.change(screen.getByLabelText('Report title'), { target: { value: 'Useful test report' } }); fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'Detailed reproduction of the issue.' } }); fireEvent.change(screen.getByLabelText('Operating system'), { target: { value: 'Windows 11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report' })); expect(await screen.findByText(/Report #42 saved/)).toBeInTheDocument();
  const call = fetch.mock.calls.find(([url, opts]) => url === '/reports' && opts?.method === 'POST'); expect(JSON.parse(call[1].body)).toMatchObject({ title: 'Useful test report', os: 'Windows 11', website: '' }); expect(screen.getByLabelText('Report title')).toHaveValue('');
});
it('blocks whitespace-only reports and displays server errors without clearing input', async () => {
  mockApi(); wrap(<ReportForm />); fireEvent.change(screen.getByLabelText('Report title'), { target: { value: '   ' } }); fireEvent.change(screen.getByLabelText('Details'), { target: { value: '          ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report' })); expect(await screen.findByText(/Use a title of/)).toBeInTheDocument();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429, json: async () => ({ ok: false, error: { message: 'Too many reports.' } }) });
  fireEvent.change(screen.getByLabelText('Report title'), { target: { value: 'Valid report' } }); fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'A detailed error case.' } }); fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByText('Too many reports.')).toBeInTheDocument(); expect(screen.getByLabelText('Report title')).toHaveValue('Valid report');
});
it('shows only fetched own reports and polls enrollment through the API route', async () => {
  vi.useFakeTimers(); let count = 0;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({ ok: true, json: async () => ({ ok: true, data: url === '/api/auth/me' ? { user: { ...owner, joined_guild: ++count > 1 ? 1 : 0 }, discordEnabled: true } : [{ id: 1, title: 'My own report', body: 'My report body.', status: 'open', created_at: '2026-10-24 12:00:00' }] }) }));
  function Page() { const { auth } = useApp(); return auth.loading ? null : <Dashboard />; }
  wrap(<Page />); await act(async () => { await Promise.resolve(); }); expect(screen.getByText('Waiting for confirmation.')).toBeInTheDocument(); expect(screen.getByText(/My own report/)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); }); expect(screen.getByText('Your place is confirmed.')).toBeInTheDocument();
  const before = fetch.mock.calls.filter(([url]) => url === '/api/auth/me').length; await act(async () => { await vi.advanceTimersByTimeAsync(6000); }); expect(fetch.mock.calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(before);
});
it('moderates, searches, filters, triages, and provides the real CSV link', async () => {
  const member = { ...owner, id: '100000000000000011', username: 'member', global_name: 'Member', is_admin: false, banned: 0, login_count: 2 };
  const fetch = mockApi(owner, { '/admin/stats': { users: 2, downloads: 3, joins: 1, reports: 1, events: [] }, '/admin/users': [member], '/admin/reports': [{ id: 7, title: 'Report to triage', body: 'Report detail', status: 'open', created_at: '2026-10-24 12:00:00' }], '/admin/users/100000000000000011': {}, '/admin/reports/7': {} }); vi.spyOn(window, 'confirm').mockReturnValue(true);
  wrap(<Admin />); fireEvent.click(await screen.findByRole('button', { name: 'Ban' })); await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/100000000000000011') && JSON.parse(options.body).action === 'ban')).toBe(true));
  fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'member' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('q=member'))).toBe(true));
  fireEvent.change(screen.getByLabelText('Status for report 7'), { target: { value: 'resolved' } }); await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => url === '/admin/reports/7' && JSON.parse(options.body).status === 'resolved')).toBe(true));
  fireEvent.change(screen.getByLabelText('Filter reports'), { target: { value: 'open' } }); await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('status=open'))).toBe(true)); expect(screen.getByRole('link', { name: 'Export users CSV' })).toHaveAttribute('href', '/admin/export.csv');
});
