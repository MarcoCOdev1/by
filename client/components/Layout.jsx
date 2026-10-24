import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useResource } from '../lib/context.jsx';
import { Avatar, Brand, Icon, JoinButton } from './ui.jsx';
const links = [['Overview', 'hero'], ['Guide', 'steps'], ['Downloads', 'downloads'], ['Community', 'community']];
export function Navigation() {
  const { auth, refreshAuth, toast, theme, setTheme, motion, paused, setPaused, reduced, playing, toggleAudio, audioBusy } = useApp();
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [signingOut, setSigningOut] = useState(false), location = useLocation(), navigate = useNavigate();
  async function signOut(event) {
    event.preventDefault();
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Fetch sends the mutation Origin even with the strict no-referrer policy.
      const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Sign-out failed. Please try again.');
      }
      navigate('/', { replace: true });
      await refreshAuth();
    } catch (error) { toast(error.message); }
    finally { setSigningOut(false); }
  }
  useEffect(() => {
    setOpen(false);
    if (location.pathname !== '/') return;
    const update = () => { let index = 0; links.forEach(([, id], i) => { if (document.getElementById(id)?.getBoundingClientRect().top < 220) index = i; }); setActive(index); };
    addEventListener('scroll', update, { passive: true }); update(); return () => removeEventListener('scroll', update);
  }, [location]);
  return <header className="site-header"><div className="nav-shell"><Brand /><nav className={`pill-nav ${open ? 'open' : ''}`} aria-label="Main navigation" data-active={active}>
    <span className="nav-indicator" aria-hidden="true" />{links.map(([label, id], i) => <Link key={id} to={`/#${id}`} aria-current={location.pathname === '/' && active === i ? 'location' : undefined}>{label}</Link>)}
  </nav><div className="nav-controls"><button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-pressed={theme === 'light'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name="sun" /></button>
    <button className="icon-button music-control" aria-label={playing ? 'Mute ambient music' : 'Play ambient music'} aria-pressed={playing} disabled={audioBusy} onClick={toggleAudio}><Icon name="music" /></button>
    <button className="icon-button" aria-label={motion ? 'Pause animation' : 'Resume animation'} aria-pressed={paused || reduced} disabled={reduced} title={reduced ? 'Reduced motion is enabled in your system settings' : undefined} onClick={() => setPaused(!paused)}><Icon name={motion ? 'pause' : 'play'} /></button>
    {auth.user ? <details className="account"><summary aria-label="Account menu"><Avatar user={auth.user} /></summary><div className="account-menu"><Link to="/dashboard">Dashboard</Link>{auth.user.is_admin && <Link to="/admin">Admin console</Link>}<form action="/auth/logout" method="post" onSubmit={signOut}><button disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></form></div></details> : <JoinButton className="nav-connect">Connect<Icon /></JoinButton>}
    <button className="icon-button mobile-menu" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} /></button>
  </div></div></header>;
}
function ConsentDialog() {
  const { loginOpen, setLoginOpen, auth } = useApp(), ref = useRef();
  useEffect(() => { if (loginOpen && !ref.current.open) ref.current.showModal(); else if (!loginOpen && ref.current.open) ref.current.close(); }, [loginOpen]);
  return <dialog ref={ref} className="consent-dialog" onClose={() => setLoginOpen(false)} aria-labelledby="consent-title"><div className="dialog-icon"><Icon name="shield" /></div><p className="eyebrow">YOUR CHOICE / YOUR ACCOUNT</p><h2 id="consent-title">A community, with your permission.</h2><p>Discord login shares your profile and email with BYPASSER and requests <strong>permission to join our Discord server automatically</strong>. A welcome role or DM may follow. The guide and downloads do not require login.</p>{!auth.discordEnabled && <p className="notice">Discord is not configured yet. You can still read every step.</p>}<div className="actions"><a className="button" href="/auth/login">Continue to Discord<Icon /></a><button className="button secondary" onClick={() => setLoginOpen(false)}>Not now</button></div></dialog>;
}
export function Footer() {
  const health = useResource('/api/health', 60000), { auth } = useApp();
  return <footer className="site-footer"><div className="footer-status"><div><p className="eyebrow">STAY IN THE LOOP</p><h2>Good things.<br />No noise.</h2><p>Guide updates and community conversations.<br />Connect on Discord when you're ready.</p><JoinButton className="button light-button">Join the conversation</JoinButton></div><div className="vitals"><p className="eyebrow">SYSTEM VITALS</p><div><span><i className={health.data ? 'status-dot' : 'status-dot offline'} />API status</span><strong>{health.data ? 'Operational' : health.loading ? 'Checking' : 'Unavailable'}</strong></div><div><span>Version</span><strong>{health.data?.version || '—'}</strong></div><div><span>Discord</span><strong>{auth.discordEnabled ? 'Configured' : 'Not configured'}</strong></div><div><span>Guide mode</span><strong>100% manual</strong></div><small>Health reflects this HTTP service, not third-party app compatibility.</small></div></div><div className="footer-bottom"><Brand /><span>© {new Date().getFullYear()} BYPASSER. Independently built.</span><div><a href="/public/license">MIT license</a><Link to="/#support">Get support<Icon /></Link></div></div><p className="legal">Not affiliated with SEVEN Corporation. Vendor assets retain their own rights. Download requests record IP/user-agent; Discord login stores profile information. Reports may be relayed to Discord.</p></footer>;
}
function Decorations() {
  const { motion } = useApp(), progress = useRef(), [back, setBack] = useState(false), [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => { const max = document.documentElement.scrollHeight - innerHeight; if (progress.current) progress.current.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; setBack(scrollY > 600); };
    addEventListener('scroll', update, { passive: true }); update(); return () => removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <><div className="ambient-background" aria-hidden="true" data-active={motion && !hidden}><div className="ambient-ribbon ribbon-primary" /><div className="ambient-ribbon ribbon-secondary" /><div className="ambient-texture" /></div><div ref={progress} className="scroll-progress" aria-hidden="true" />{back && <button className="back-top icon-button" aria-label="Back to top" onClick={() => scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' })}>↑</button>}</>;
}
export function Layout() {
  const location = useLocation(), { toast } = useApp();
  useEffect(() => {
    if (!location.hash) { scrollTo(0, 0); return; }
    let tries = 0;
    const timer = setInterval(() => { const target = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (target) { target.scrollIntoView({ behavior: 'instant' }); clearInterval(timer); } else if (++tries > 50) clearInterval(timer); }, 100);
    return () => clearInterval(timer);
  }, [location]);
  useEffect(() => { const msg = { unconfigured: 'Discord is not configured. The full guide is available.', required: 'Log in with Discord to open your dashboard.', cancelled: 'Discord login was cancelled.', failed: 'Discord login failed. Please try again.' }[new URLSearchParams(location.search).get('auth')]; if (msg) toast(msg); }, [location.search]);
  return <><a href="#main" className="skip-link">Skip to content</a><Decorations /><Navigation /><main id="main"><Outlet /></main><Footer /><ConsentDialog /></>;
}
