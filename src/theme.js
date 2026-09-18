export const T = {
  bg: '#060f22', surface: 'rgba(255,255,255,0.04)', surface2: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.1)', teal: '#06b6d4', tealDark: '#0891b2',
  text: '#ffffff', textMuted: 'rgba(255,255,255,0.65)', textDim: 'rgba(255,255,255,0.38)',
  success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6',
  navyMid: '#0a1628',
  panel: '#0d1f3c',            // fond opaque des fenêtres d'édition (au-dessus du voile sombre)
  field: '#13294a',            // fond opaque des champs de saisie
};

export const statusConf = {
  actif:     { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Actif'      },
  en_cours:  { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', label: 'En cours'   },
  planifie:  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Planifié'   },
  planifiee: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Planifiée'  },
  fait:      { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Fait'       },
  tenue:     { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Tenue'      },
  annulee:   { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Annulée'    },
  on_track:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'On track'   },
  attention: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Attention'  },
  risque:    { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Risque'     },
  critique:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Critique'   },
  haute:     { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Haute'      },
  moyenne:   { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', label: 'Moyenne'    },
  terminee:      { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Terminée'        },
  structuration: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'En structuration' },
  maturation:    { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', label: 'Maturation'       },
  execution:     { bg: 'rgba(6,182,212,0.15)',  color: '#06b6d4', label: 'En exécution'     },
  cloture:       { bg: 'rgba(107,114,128,0.15)',color: '#6b7280', label: 'Clôturé'          },
  exploitation:  { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Exploitation'     },
};

// Valeurs de repli si l'API /settings est indisponible (les valeurs réelles sont modifiables dans Administration)
export const SETTINGS_FALLBACK = {
  org_short_name: 'DU–MCTN', org_subtitle: 'Delivery Unit', org_name: 'Delivery Unit',
  ministry_short: 'MCTN', ministry_name: 'Ministère de la Communication, des Télécommunications et du Numérique',
  country: 'Sénégal', plan_name: 'New Deal Technologique', plan_short: 'NDT', plan_start: '2025', plan_end: '2034',
  currency_unit: 'Md FCFA', email_domain: 'mctn.sn', phone_prefix: '+221',
  score_thresholds: '[75,50,30]', alert_days: '3', program_progress_mode: 'manual',
};

// Obsolète : préférer useRefData().scoreColor (seuils paramétrables)
export const scoreColor =s => s >= 75 ? '#10b981' : s >= 50 ? '#06b6d4' : s >= 30 ? '#f59e0b' : '#ef4444';
