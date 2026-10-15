import { useRefData } from '../context/RefContext.jsx';
import { settingsApi } from '../api.js';
import { T } from '../theme.js';

/* Logo de l'organisation.
 *
 * Un fichier téléversé (paramètre logo_file) remplace l'ensemble du bloc. Sans fichier, le logo
 * dessiné est utilisé : bandeau, étoile et trait prennent les couleurs des paramètres, et une
 * couleur vide masque l'élément correspondant.
 *
 * onDark : logo posé sur un aplat sombre (barre de navigation), quel que soit le thème. */
export default function LogoDU({ size = 'md', onDark = false }) {
  const ref = useRefData();
  const s = size === 'sm'
    ? { bar: 28, star: 9, title: 13, line: 1.5, sub: 7.5, gap: 3, img: 30 }
    : { bar: 44, star: 13, title: 20, line: 2, sub: 10, gap: 5, img: 64 };

  const shortName = ref?.setting('org_short_name') || 'DU-MCTN';
  const file      = ref?.setting('logo_file') || '';

  if (file) return (
    <img src={settingsApi.logoUrl(file)} alt={shortName}
      style={{ height: s.img, maxWidth: s.img * 5, objectFit: 'contain', userSelect: 'none' }} />
  );

  const DEFAULT_FLAG = ['#1DB954', '#F7D20A', '#E8001C'];
  const flag = ref?.json('logo_flag_colors', DEFAULT_FLAG) || DEFAULT_FLAG;
  const star = ref?.setting('logo_star_color');
  const line = ref?.setting('logo_line_color');
  const last = flag.length - 1;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: s.gap, userSelect: 'none' }}>
      {/* Bandeau (drapeau) */}
      {flag.length > 0 && (
        <div style={{ position: 'relative', width: s.bar * 2.8, height: s.bar * 0.18, display: 'flex', borderRadius: 2, overflow: 'visible' }}>
          {flag.map((c, i) => (
            <div key={i} style={{ flex: 1, background: c, borderRadius: i === 0 ? '2px 0 0 2px' : i === last ? '0 2px 2px 0' : 0 }} />
          ))}
          {star && (
            <span style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              fontSize: s.star, color: star, lineHeight: 1, fontWeight: 900, textShadow: `0 0 0 ${star}`
            }}>★</span>
          )}
        </div>
      )}

      {/* Sigle (paramétrable) */}
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: s.title,
        fontWeight: 700,
        color: onDark ? '#ffffff' : T.text,
        letterSpacing: 1,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>{shortName}</div>

      {/* Trait de séparation */}
      {line && <div style={{ width: s.bar * 2.8, height: s.line, background: line, borderRadius: 1 }} />}

      {/* Sous-titre */}
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: s.sub,
        fontWeight: 500,
        color: onDark ? 'rgba(255,255,255,0.7)' : T.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>{ref?.setting('org_subtitle') || 'Delivery Unit'}</div>
    </div>
  );
}
