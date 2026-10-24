import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '../lib/api.js';
import { useApp } from '../lib/context.jsx';
export function Icon({ name = 'arrow', ...props }) {
  const paths = { arrow: 'M7 17 17 7M7 7h10v10', download: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1', copy: 'M8 8h12v13H8zM16 8V3H3v13h5', check: 'm5 12 4 4L19 6', music: 'M9 18V5l11-2v13M9 8l11-2M5 21a4 3 0 1 0 0-6 4 3 0 1 0 0 6m11-2a4 3 0 1 0 0-6 4 3 0 1 0 0 6', pause: 'M8 5v14M16 5v14', play: 'm8 5 11 7-11 7Z', menu: 'M4 7h16M4 12h16M4 17h16', close: 'm6 6 12 12M6 18 18 6', shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6' };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.arrow} />{name === 'sun' && <circle cx="12" cy="12" r="4" />}</svg>;
}
export function Brand() { return <Link to="/" className="brand" aria-label="BYPASSER home"><img src="/public/img/logo.svg" alt="" /><span>BYPASSER<span className="brand-dot">®</span></span></Link>; }
export function JoinButton({ children, className = 'button', reconnect = false }) {
  const { auth, setLoginOpen } = useApp();
  if (auth.user?.joined_guild && !reconnect) return <Link to="/dashboard" className={className}>{children || "You're in"}<Icon /></Link>;
  return <button className={className} onClick={() => setLoginOpen(true)}>{children || 'Connect with Discord'}<Icon /></button>;
}
export function CodeBlock({ command, label = 'POWERSHELL' }) {
  const { toast } = useApp(), [copied, setCopied] = useState(false), timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await copyText(command); setCopied(true); toast('Command copied to your clipboard.'); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000); }
    catch (error) { toast(error.message || 'Clipboard blocked. Select the command and copy manually.'); }
  };
  return <div className="code-block"><div className="code-head"><span><span className="terminal-dot" />{label}</span><button onClick={copy} aria-label={`Copy ${label.toLowerCase()} command`}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy'}</button></div><pre tabIndex="0"><code>{command}</code></pre></div>;
}
export function SectionHeading({ number, eyebrow, title, children }) { return <div className="section-heading"><p className="eyebrow"><span>{number} /</span> {eyebrow}</p><h2>{title}</h2>{children && <p className="section-description">{children}</p>}</div>; }
export function Avatar({ user }) {
  const [failed, setFailed] = useState(false), valid = /^[a-f0-9_]+$/.test(user.avatar || '') && /^\d+$/.test(user.id);
  return valid && !failed ? <img className="avatar" src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`} alt={`${user.username}'s avatar`} onError={() => setFailed(true)} /> : <span className="avatar avatar-fallback">{(user.global_name || user.username || '?').slice(0, 1).toUpperCase()}</span>;
}
export function Status({ error, loading }) { return error ? <p className="notice error" role="alert">{error}</p> : loading ? <p className="muted" role="status">Loading…</p> : null; }
export const formatCount = n => typeof n === 'number' ? n.toLocaleString('en-US') : '—';
export function TiltCard({ children, className = '' }) {
  const { motion } = useApp(), ref = useRef();
  return <article ref={ref} className={`card tilt-card ${className}`} onPointerMove={event => {
    if (!motion || event.pointerType !== 'mouse') return;
    const rect = ref.current.getBoundingClientRect(); ref.current.style.transform = `perspective(900px) rotateX(${(.5 - (event.clientY - rect.top) / rect.height) * 3}deg) rotateY(${((event.clientX - rect.left) / rect.width - .5) * 3}deg)`;
  }} onPointerLeave={() => { ref.current.style.transform = ''; }}>{children}</article>;
}
