import { useState } from 'react';
import { post } from '../lib/api.js';
import { Icon } from './ui.jsx';
export function ReportForm() {
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    if (fields.title.trim().length < 3 || fields.body.trim().length < 10) { setStatus('Use a title of 3–120 characters and details of 10–5000 characters.'); return; }
    setBusy(true); setStatus('Saving your report…');
    try { const data = await post('/reports', fields); setStatus(`Report #${data.id} saved. Thank you for the details.`); form.reset(); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  return <form className="report-form card" onSubmit={submit}><p className="eyebrow">LET'S FIGURE IT OUT</p><h3>Tell us what happened.</h3><label>Report title<input name="title" placeholder="A short, helpful summary" minLength="3" maxLength="120" required /></label><div className="form-row"><label>Operating system<input name="os" placeholder="Windows 11" maxLength="100" /></label><label>App version<input name="appver" placeholder="If known" maxLength="50" /></label></div><label>Details<textarea name="body" placeholder="What did you try? What did you expect? Include any error messages, but never passwords or tokens." minLength="10" maxLength="5000" rows="6" required /></label><div className="honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex="-1" autoComplete="off" /></label></div><div className="report-form-bottom"><small>No login required. Up to 5 reports/hour.<br />Reports may be shared with the support team on Discord.</small><button className="button" disabled={busy}>{busy ? 'Sending…' : 'Send report'}<Icon /></button></div><p className="form-status" role="status">{status}</p></form>;
}
