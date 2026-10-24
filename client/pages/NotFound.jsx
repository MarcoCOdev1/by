import { Link } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';
export default function NotFound() {
  return <section className="not-found"><p className="eyebrow">A SMALL DETOUR</p><div className="error-art"><span className="error-number">404<span>●</span></span><Link className="error-card error-card-0" to="/#steps"><span>FIELD NOTES / 01</span><strong>The guide</strong><Icon /></Link><Link className="error-card error-card-1" to="/#downloads"><span>TAKE SOMETHING WITH YOU</span><strong>The files</strong><Icon name="download" /></Link><Link className="error-card error-card-2" to="/#support"><span>WE'RE OVER HERE</span><strong>Support</strong><Icon /></Link></div><h1>This page went off-script.</h1><p>No problem. The useful stuff is one click away.</p><Link className="button" to="/">Back to home<Icon /></Link></section>;
}
