export default function LogoDU({ size = 'md' }) {
  const s = size === 'sm'
    ? { bar: 28, star: 9, title: 13, line: 1.5, sub: 7.5, gap: 3 }
    : { bar: 44, star: 13, title: 20, line: 2, sub: 10, gap: 5 };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: s.gap, userSelect: 'none' }}>
      {/* Barre drapeau sénégalais */}
      <div style={{ position: 'relative', width: s.bar * 2.8, height: s.bar * 0.18, display: 'flex', borderRadius: 2, overflow: 'visible' }}>
        <div style={{ flex: 1, background: '#1DB954', borderRadius: '2px 0 0 2px' }} />
        <div style={{ flex: 1, background: '#F7D20A' }} />
        <div style={{ flex: 1, background: '#E8001C', borderRadius: '0 2px 2px 0' }} />
        <span style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          fontSize: s.star, color: '#1DB954', lineHeight: 1, fontWeight: 900, textShadow: '0 0 0 #1DB954'
        }}>★</span>
      </div>

      {/* Texte DU–MTN */}
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: s.title,
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: 1,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>DU–MTN</div>

      {/* Ligne bleue */}
      <div style={{ width: s.bar * 2.8, height: s.line, background: '#3B82F6', borderRadius: 1 }} />

      {/* Sous-titre */}
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: s.sub,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>Unité d'Appui Technique</div>
    </div>
  );
}
