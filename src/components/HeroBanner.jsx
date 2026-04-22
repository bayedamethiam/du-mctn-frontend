import { T } from '../theme.js';

const Wave = ({ color = T.teal }) => (
  <svg viewBox="0 0 1440 80" preserveAspectRatio="none"
    style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 80, pointerEvents: 'none' }}>
    <path fill={color} fillOpacity={0.12} d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
    <path fill={color} fillOpacity={0.07}  d="M0,60 C480,20 960,80 1440,50 L1440,80 L0,80 Z" />
  </svg>
);

export default function HeroBanner({ eyebrow, title, subtitle, stats = [], color = T.teal }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#060f22 0%,#0a1e3d 60%,#0d2a4a 100%)', padding: '40px 36px 56px', position: 'relative', overflow: 'hidden', borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
      <div style={{ position: 'absolute', top: -60, right: -40, width: 300, height: 300, background: `radial-gradient(circle,${color}18 0%,transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
      <p style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color, marginBottom: 10 }}>{eyebrow}</p>
      <h1 style={{ fontFamily: 'EB Garamond', fontSize: 36, fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: 8 }}>{title}</h1>
      {subtitle && <p style={{ fontFamily: 'DM Sans', fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 560 }}>{subtitle}</p>}
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 36, marginTop: 28, flexWrap: 'wrap' }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'EB Garamond', fontSize: 30, fontWeight: 600, color: s.color || color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <Wave color={color} />
    </div>
  );
}
