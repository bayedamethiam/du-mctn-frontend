export const T = {
  bg: '#060f22', surface: 'rgba(255,255,255,0.04)', surface2: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.1)', teal: '#06b6d4', tealDark: '#0891b2',
  text: '#ffffff', textMuted: 'rgba(255,255,255,0.65)', textDim: 'rgba(255,255,255,0.38)',
  success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6',
  navyMid: '#0a1628',
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
  terminee:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Terminée'   },
};

export const scoreColor = s => s >= 75 ? '#10b981' : s >= 50 ? '#06b6d4' : s >= 30 ? '#f59e0b' : '#ef4444';
