import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useResource } from '../lib/context.jsx';
import { Avatar, Icon, JoinButton, SectionHeading, Status } from '../components/ui.jsx';
export default function Dashboard() {
  const { auth, setAuth } = useApp(), reports = useResource('/reports'), [error, setError] = useState('');
  useEffect(() => {
    if (auth.user?.joined_guild) return;
    let polls = 0, running = false, alive = true;
    const timer = setInterval(async () => {
      if (document.hidden || running) return; running = true;
      try { const data = await api('/api/auth/me'); if (alive) setAuth({ ...data, loading: false, error: '' }); if (data.user?.joined_guild || !data.user || ++polls >= 30) clearInterval(timer); }
      catch (e) { if (alive) setError(e.message); clearInterval(timer); if ([401, 403].includes(e.status)) setAuth({ user: null, discordEnabled: true, loading: false, error: e.message }); }
      finally { running = false; }
    }, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [auth.user?.id, auth.user?.joined_guild]);
  const user = auth.user; if (!user) return null;
  return <div className="account-page"><SectionHeading number="ACCOUNT" eyebrow="YOUR CORNER" title="Welcome back.">Your profile, your enrollment, and your reports. All in one place.</SectionHeading><Status error={error} /><div className="dashboard-grid"><section className="card profile-card"><div className="profile-header"><Avatar user={user} /><div><h2>{user.global_name || user.username}</h2><p>@{user.username}</p><span className="badge">{user.is_admin ? 'ADMINISTRATOR' : 'COMMUNITY MEMBER'}</span></div></div><div className="profile-info"><span>Discord ID</span><code>{user.id}</code></div><p className="small muted">Email and locale are not exposed in your public profile.</p></section><section className="card enrollment-card"><Icon name="shield" /><p className="eyebrow">DISCORD ENROLLMENT</p><h3>{user.joined_guild ? 'Your place is confirmed.' : 'Waiting for confirmation.'}</h3><p role="status">{user.joined_guild ? 'Your server enrollment is confirmed. This records a successful join, not continuous membership.' : 'Enrollment has not been confirmed yet. Reconnect with Discord if it does not update.'}</p>{user.joined_at && <p className="small muted">Recorded: {user.joined_at} UTC</p>}<JoinButton reconnect className="button secondary">Reconnect with Discord</JoinButton></section></div><section className="dashboard-reports"><div className="split-heading"><h2>Your reports</h2><Link className="text-link" to="/#support">Submit a report<Icon /></Link></div><Status {...reports} />{reports.data?.length === 0 && <div className="empty-state card">No reports yet. If something goes wrong, send a report from the guide.</div>}{reports.data?.map(report => <article className="card report-item" key={report.id}><header><h3>#{report.id} · {report.title}</h3><span className="badge">{report.status}</span></header><p>{report.body}</p><time dateTime={`${report.created_at.replace(' ', 'T')}Z`}>{report.created_at} UTC</time></article>)}</section><Link className="button secondary" to="/#steps">Back to the manual<Icon /></Link></div>;
}
