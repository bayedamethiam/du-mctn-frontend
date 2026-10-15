/* Thème de l'application.
 *
 * Les jetons `T` ne contiennent pas de couleurs mais des variables CSS : le mode clair et le mode
 * sombre se contentent donc de redéfinir ces variables sur <html>, sans toucher aux composants.
 * Les styles en ligne acceptent `var(--x)` comme n'importe quelle couleur. */

/* Palettes. Les accents (teal, success, warning, danger, purple) sont ajustés en mode clair pour
 * rester lisibles sur fond blanc. */
export const PALETTES = {
  dark: {
    bg: '#060f22',
    surface: 'rgba(255,255,255,0.04)',
    surface2: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.1)',
    text: '#ffffff',
    'text-muted': 'rgba(255,255,255,0.65)',
    'text-dim': 'rgba(255,255,255,0.38)',
    teal: '#06b6d4',
    'teal-dark': '#0891b2',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    'navy-mid': '#0a1628',
    panel: '#0d1f3c',
    field: '#13294a',
    'hero-from': '#060f22',
    'hero-via': '#0a1e3d',
    'hero-to': '#0d2a4a',
    'header-from': '#0a1628',
    'header-to': '#0a1e3d',
    'menu-bg': '#0d1f3c',
    overlay: 'rgba(3,8,20,0.82)',
    'track': 'rgba(255,255,255,0.08)',
    'surface-subtle': 'rgba(255,255,255,0.02)',
    'border-hover': 'rgba(255,255,255,0.22)',
    'shadow': 'rgba(0,0,0,0.55)',
    'on-accent': '#ffffff',
  },
  light: {
    bg: '#f4f7fb',
    surface: '#ffffff',
    surface2: '#eef2f8',
    border: 'rgba(11,60,110,0.14)',
    text: '#0b1f33',
    'text-muted': 'rgba(11,31,51,0.70)',
    'text-dim': 'rgba(11,31,51,0.55)',
    teal: '#0e7490',
    'teal-dark': '#155e75',
    success: '#047857',
    warning: '#b45309',
    danger: '#b91c1c',
    purple: '#6d28d9',
    'navy-mid': '#e8eef7',
    panel: '#ffffff',
    field: '#ffffff',
    'hero-from': '#0b3c6e',
    'hero-via': '#114d87',
    'hero-to': '#1565a5',
    'header-from': '#0b3c6e',
    'header-to': '#114d87',
    'menu-bg': '#ffffff',
    overlay: 'rgba(11,31,51,0.45)',
    'track': 'rgba(11,31,51,0.14)',
    'surface-subtle': 'rgba(255,255,255,0.65)',
    'border-hover': 'rgba(11,60,110,0.32)',
    'shadow': 'rgba(11,31,51,0.18)',
    'on-accent': '#ffffff',
  },
};

/* Jetons utilisés par les composants : toujours des variables CSS */
const v = name => `var(--du-${name})`;
export const T = {
  bg: v('bg'), surface: v('surface'), surface2: v('surface2'),
  border: v('border'), teal: v('teal'), tealDark: v('teal-dark'),
  text: v('text'), textMuted: v('text-muted'), textDim: v('text-dim'),
  success: v('success'), warning: v('warning'), danger: v('danger'), purple: v('purple'),
  navyMid: v('navy-mid'),
  panel: v('panel'),            // fond opaque des fenêtres d'édition
  field: v('field'),            // fond opaque des champs de saisie
  heroFrom: v('hero-from'), heroVia: v('hero-via'), heroTo: v('hero-to'),
  headerFrom: v('header-from'), headerTo: v('header-to'),
  menuBg: v('menu-bg'), overlay: v('overlay'), track: v('track'), shadow: v('shadow'),
  surfaceSubtle: v('surface-subtle'),   // voile très discret (barres d'onglets secondaires)
  borderHover: v('border-hover'),       // bordure au survol d'une carte
  onAccent: v('on-accent'),     // texte posé sur un aplat de couleur d'accent
};

/* Teinte translucide d'une couleur, qu'elle soit littérale (#06b6d4) ou variable CSS (var(--du-teal)).
 * Remplace les concaténations hexadécimales du type `${T.teal}22`, impossibles avec des variables. */
export const alpha = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/* Applique un mode : 'light', 'dark' ou 'system' (suit le réglage du système) */
const MODES = ['light', 'dark', 'system'];
const prefersDark = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const resolveMode = mode => (mode === 'system' || !MODES.includes(mode))
  ? (prefersDark() ? 'dark' : 'light')
  : mode;

export function applyTheme(mode) {
  if (typeof document === 'undefined') return 'dark';
  const resolved = resolveMode(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  for (const [key, value] of Object.entries(PALETTES[resolved])) root.style.setProperty(`--du-${key}`, value);
  root.style.colorScheme = resolved;
  return resolved;
}

// Valeurs de repli si l'API /settings est indisponible (valeurs réelles modifiables dans Administration)
export const SETTINGS_FALLBACK = {
  org_short_name: 'DU-MCTN', org_subtitle: 'Delivery Unit', org_name: 'Delivery Unit',
  ministry_short: 'MCTN', ministry_name: 'Ministère de la Communication, des Télécommunications et du Numérique',
  country: 'Sénégal', plan_name: 'New Deal Technologique', plan_short: 'NDT', plan_start: '2025', plan_end: '2034',
  currency_unit: 'Md FCFA', email_domain: 'mctn.sn', phone_prefix: '+221',
  score_thresholds: '[75,50,30]', alert_days: '3', program_progress_mode: 'manual', default_theme: 'dark',
};

/* Repli d'affichage des statuts quand le référentiel ne fournit rien.
 * Les fonds sont semi-transparents : ils fonctionnent sur les deux thèmes. */
export const statusConf = {
  actif:     { bg: 'rgba(16,185,129,0.15)',  color: T.success, label: 'Actif'      },
  en_cours:  { bg: 'rgba(6,182,212,0.15)',   color: T.teal,    label: 'En cours'   },
  planifie:  { bg: 'rgba(245,158,11,0.15)',  color: T.warning, label: 'Planifié'   },
  planifiee: { bg: 'rgba(245,158,11,0.15)',  color: T.warning, label: 'Planifiée'  },
  fait:      { bg: 'rgba(16,185,129,0.15)',  color: T.success, label: 'Fait'       },
  tenue:     { bg: 'rgba(16,185,129,0.15)',  color: T.success, label: 'Tenue'      },
  annulee:   { bg: 'rgba(239,68,68,0.15)',   color: T.danger,  label: 'Annulée'    },
  on_track:  { bg: 'rgba(16,185,129,0.15)',  color: T.success, label: 'On track'   },
  attention: { bg: 'rgba(245,158,11,0.15)',  color: T.warning, label: 'Attention'  },
  risque:    { bg: 'rgba(239,68,68,0.15)',   color: T.danger,  label: 'Risque'     },
  critique:  { bg: 'rgba(239,68,68,0.15)',   color: T.danger,  label: 'Critique'   },
  haute:     { bg: 'rgba(245,158,11,0.15)',  color: T.warning, label: 'Haute'      },
  moyenne:   { bg: 'rgba(6,182,212,0.15)',   color: T.teal,    label: 'Moyenne'    },
  terminee:      { bg: 'rgba(16,185,129,0.15)', color: T.success, label: 'Terminée'        },
  structuration: { bg: 'rgba(245,158,11,0.15)', color: T.warning, label: 'En structuration' },
  maturation:    { bg: 'rgba(139,92,246,0.15)', color: T.purple,  label: 'Maturation'       },
  execution:     { bg: 'rgba(6,182,212,0.15)',  color: T.teal,    label: 'En exécution'     },
  cloture:       { bg: 'rgba(107,114,128,0.15)',color: T.textMuted, label: 'Clôturé'        },
  exploitation:  { bg: 'rgba(16,185,129,0.15)', color: T.success, label: 'Exploitation'     },
};
