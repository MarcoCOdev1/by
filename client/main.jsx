import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/context.jsx';
import { api } from './lib/api.js';
import { Layout } from './components/Layout.jsx';
import { Status } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';
import './styles.css';
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
function Protected({ admin = false, children }) {
  const { auth, setAuth } = useApp(), { pathname } = useLocation(), [checked, setChecked] = useState(false);
  useEffect(() => {
    let alive = true; setChecked(false);
    void api('/api/auth/me').then(data => { if (alive) { setAuth({ ...data, loading: false, error: '' }); setChecked(true); } }).catch(error => { if (alive) { setAuth({ user: null, loading: false, error: error.message }); setChecked(true); } });
    return () => { alive = false; };
  }, [pathname]);
  if (!checked || auth.loading) return <div className="account-page"><Status loading /></div>;
  if (!auth.user) return <Navigate to="/?auth=required" replace />;
  if (admin && !auth.user.is_admin) return <div className="account-page"><h1>Administrator access required.</h1><p>Your account does not have permission to open this console.</p></div>;
  return children;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><AppProvider><Suspense fallback={<p className="account-page" role="status">Loading page…</p>}><Routes><Route element={<Layout />}><Route index element={<Landing />} /><Route path="dashboard" element={<Protected><Dashboard /></Protected>} /><Route path="admin" element={<Protected admin><Admin /></Protected>} /><Route path="*" element={<NotFound />} /></Route></Routes></Suspense></AppProvider></BrowserRouter>);
