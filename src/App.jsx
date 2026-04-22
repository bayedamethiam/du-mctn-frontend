import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import Portefeuille from './pages/Portefeuille.jsx';
import Diligences   from './pages/Diligences.jsx';
import Partenariats from './pages/Partenariats.jsx';
import Audiences    from './pages/Audiences.jsx';
import SuiviEval    from './pages/SuiviEval.jsx';
import Instances    from './pages/Instances.jsx';
import Equipe       from './pages/Equipe.jsx';
import { dashboardApi } from './api.js';
import { Spinner } from './components/UI.jsx';
import { T } from './theme.js';

const VIEWS = {
  dashboard: Dashboard, portefeuille: Portefeuille,
  diligences: Diligences, partenariats: Partenariats,
  audiences: Audiences, se: SuiviEval,
  instances: Instances, equipe: Equipe,
};

export default function App() {
  const { user, loading } = useAuth();
  const [view, setView]   = useState('dashboard');
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    if (!user) return;
    dashboardApi.alerts().then(setAlerts).catch(() => {});
    const t = setInterval(() => dashboardApi.alerts().then(setAlerts).catch(() => {}), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Spinner size={40} />
        <p style={{ fontFamily: 'DM Sans', color: 'rgba(255,255,255,0.4)', marginTop: 16, fontSize: 13 }}>Chargement…</p>
      </div>
    </div>
  );

  if (!user) return <Login />;

  const V = VIEWS[view] || Dashboard;
  return (
    <Layout view={view} setView={setView} alerts={alerts}>
      <V />
    </Layout>
  );
}
