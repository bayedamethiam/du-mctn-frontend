import { T } from '../theme.js';

const Wave = ({ color = T.teal }) => (
  <svg viewBox="0 0 1440 80" preserveAspectRatio="none"
    style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 80, pointerEvents: 'none' }}>
    <path fill={color} fillOpacity={0.12} d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
    <path fill={color} fillOpacity={0.07}  d="M0,60 C480,20 960,80 1440,50 L1440,80 L0,80 Z" />
  </svg>
);

export default function HeroBanner({ eyebrow, title, subtitle, stats = [], color = T.teal, action = null }) {
  /* Le bandeau reste bleu nuit dans les deux thèmes : les accents sont éclaircis pour y rester lisibles */
  const accent = `color-mix(in srgb, ${color} 55%, #ffffff)`;
  return (
    <div style={{ background: `linear-gradient(135deg,${T.heroFrom} 0%,${T.heroVia} 60%,${T.heroTo} 100%)`, padding: '40px 36px 56px', position: 'relative', overflow: 'hidden', borderBottom: `1px solid rgba(255,255,255,0.12)` }}>
      <div style={{ position: 'absolute', top: -60, right: -40, width: 300, height: 300, background: 'radial-gradient(circle,rgba(255,255,255,0.10) 0%,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      {action && (
        <button onClick={action.onClick}
          style={{ position: 'absolute', top: 24, right: 28, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: accent, cursor: 'pointer', transition: 'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}>
          {action.icon && action.icon}
          {action.label}
        </button>
      )}
      <p style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: accent, marginBottom: 10 }}>{eyebrow}</p>
      <h1 style={{ fontFamily: 'EB Garamond', fontSize: 36, fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: 8 }}>{title}</h1>
      {subtitle && <p style={{ fontFamily: 'DM Sans', fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 560 }}>{subtitle}</p>}
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 36, marginTop: 28, flexWrap: 'wrap' }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'EB Garamond', fontSize: 30, fontWeight: 600, color: s.color ? `color-mix(in srgb, ${s.color} 55%, #ffffff)` : accent, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <Wave color={accent} />
    </div>
  );
}
