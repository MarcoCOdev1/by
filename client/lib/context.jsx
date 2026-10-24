import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }) {
  const [auth, setAuth] = useState({ user: null, discordEnabled: false, loading: true, error: '' });
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('bypasser.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [paused, setPaused] = useState(false), [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [message, setMessage] = useState(''), [loginOpen, setLoginOpen] = useState(false), [playing, setPlaying] = useState(false), [audioBusy, setAudioBusy] = useState(false);
  const audio = useRef({}), toastTimer = useRef();
  const toast = text => { setMessage(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setMessage(''), 4500); };
  const refreshAuth = async () => {
    try { const data = await api('/api/auth/me'); setAuth({ ...data, loading: false, error: '' }); return data.user; }
    catch (error) { setAuth({ user: null, discordEnabled: false, loading: false, error: error.message }); throw error; }
  };
  useEffect(() => { void refreshAuth().catch(() => {}); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('bypasser.theme', theme); } catch { /* Storage is optional. */ } }, [theme]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => setReduced(media.matches);
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => { document.documentElement.dataset.motion = paused || reduced ? 'off' : 'on'; }, [paused, reduced]);
  useEffect(() => () => { clearTimeout(toastTimer.current); audio.current.track?.pause(); }, []);
  async function toggleAudio() {
    if (audioBusy) return; setAudioBusy(true);
    try {
      const a = audio.current;
      if (playing) { a.track?.pause(); setPlaying(false); toast('Music off.'); return; }
      a.track ||= Object.assign(new Audio('/public/audio/li7wak.mp3'), { loop: true, volume: .15, preload: 'none' });
      // Start playback directly from the click; no fetch may consume the user gesture.
      await a.track.play();
      setPlaying(true); toast('Playing li7wak.');
    } catch { audio.current.track?.pause(); setPlaying(false); toast('Music could not play. Check li7wak.mp3 and try again.'); } finally { setAudioBusy(false); }
  }
  return <AppContext.Provider value={{ auth, setAuth, refreshAuth, theme, setTheme, paused, setPaused, reduced, motion: !paused && !reduced, toast, loginOpen, setLoginOpen, playing, audioBusy, toggleAudio }}>
    {children}<div className={`toast ${message ? 'shown' : ''}`} role="status">{message}</div>
  </AppContext.Provider>;
}
export function useResource(url, interval = 0) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  useEffect(() => {
    let alive = true, running = false; const controller = new AbortController();
    const load = async () => {
      if (running) return; running = true;
      try { const data = await api(url, { signal: controller.signal }); if (alive) setState({ data, error: '', loading: false }); }
      catch (error) { if (alive && error.name !== 'AbortError') setState({ data: null, error: error.message, loading: false }); }
      finally { running = false; }
    };
    void load(); const timer = interval ? setInterval(() => { if (!document.hidden) void load(); }, interval) : null;
    return () => { alive = false; controller.abort(); clearInterval(timer); };
  }, [url, interval]);
  return state;
}
