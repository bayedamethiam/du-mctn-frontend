import { useState, useEffect } from 'react';
import { programsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

export default function Portefeuille() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    programsApi.list().then(setPrograms).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const total = programs.reduce((s, p) => s + (p.budget || 0), 0).toFixed(1);
  const avgP  = programs.length ? Math.round(programs.reduce((s, p) => s + p.progress, 0) / programs.length) : 0;

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Portefeuille NDT 2025–2034" title="12 programmes prioritaires"
        subtitle="New Deal Technologique · Suivi budgétaire et physique"
        stats={[
          { value: programs.length, label: 'Programmes' },
          { value: `${total}Md`,    label: 'FCFA total', color: '#10b981' },
          { value: `${avgP}%`,      label: 'Avancement moyen' },
        ]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {programs.map(p => (
                <Card key={p.id} hover style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 2, color: p.color || T.teal, textTransform: 'uppercase' }}>{p.code}</span>
                      <h4 style={{ fontFamily: 'EB Garamond', fontSize: 17, color: T.text, marginTop: 2, lineHeight: 1.2 }}>{p.name}</h4>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'EB Garamond', fontSize: 22, color: p.color || T.teal, fontWeight: 500 }}>{p.projects_count}</div>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>Projets</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'EB Garamond', fontSize: 22, color: T.text, fontWeight: 500 }}>{p.budget}Md</div>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>FCFA</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>Avancement physique</span>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600, color: p.color || T.teal }}>{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} color={p.color || T.teal} height={5} />
                </Card>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
