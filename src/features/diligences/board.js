/* Règles du tableau des diligences, sans aucun affichage (fonctions pures, testables).
 *
 * Colonnes :
 *   - « En retard » (calculée) : échéance dépassée et statut non clôturé, quel que soit le statut ;
 *   - une colonne par statut du référentiel diligence_status, dans l'ordre du référentiel
 *     (une diligence en retard n'apparaît pas une seconde fois dans la colonne de son statut) ;
 *   - une colonne de plus par statut inconnu du référentiel encore présent dans les données
 *     (valeur historique), pour ne jamais masquer une diligence. */

export const LATE_COLUMN = '__en_retard__';

/* Date du jour au format AAAA-MM-JJ, en heure locale */
export function todayYmd(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

const ymd = value => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

export function isLate(diligence, today, closedCodes) {
  const deadline = ymd(diligence.deadline);
  return !!deadline && deadline < today && !closedCodes.includes(String(diligence.status));
}

export function buildColumns({ items, statuses, closedCodes, today, lateColor }) {
  const late = d => isLate(d, today, closedCodes);
  const known = new Set(statuses.map(s => String(s.code)));
  const columns = [{
    id: LATE_COLUMN, kind: 'late', label: 'En retard', color: lateColor, closed: false,
    hint: 'Échéance dépassée, diligence non clôturée', items: items.filter(late),
  }];
  for (const s of statuses) {
    columns.push({
      id: String(s.code), kind: 'status', label: s.label, color: s.color, closed: closedCodes.includes(String(s.code)),
      hint: s.meta?.desc || null, items: items.filter(d => String(d.status) === String(s.code) && !late(d)),
    });
  }
  const orphanCodes = [...new Set(items.filter(d => !known.has(String(d.status)) && !late(d)).map(d => String(d.status)))];
  for (const code of orphanCodes) {
    columns.push({ id: code, kind: 'status', label: code, color: null, closed: false, hint: 'Statut absent du référentiel', items: items.filter(d => String(d.status) === code && !late(d)) });
  }
  return columns;
}

const DAY = 86_400_000;
const daysBetween = (fromYmd, toYmd) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY);

const fmt = (d, withYear) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  .format(new Date(`${d}T12:00:00`));

/* Échéance affichée sur une carte : libellé court, ton (danger, warning, success, neutral), date complète */
export function deadlineInfo(deadline, { today, alertDays = 3, closed = false, done = false }) {
  const d = ymd(deadline);
  if (!d) return null;
  const withYear = d.slice(0, 4) !== today.slice(0, 4);
  const full = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`));
  if (closed) return { label: fmt(d, withYear), tone: done ? 'success' : 'neutral', full };
  const days = daysBetween(today, d);
  if (days < 0) return { label: `${-days} j de retard`, tone: 'danger', full, days };
  if (days === 0) return { label: 'Aujourd\'hui', tone: 'warning', full, days };
  if (days === 1) return { label: 'Demain', tone: 'warning', full, days };
  if (days <= alertDays) return { label: `Dans ${days} j`, tone: 'warning', full, days };
  return { label: fmt(d, withYear), tone: 'neutral', full, days };
}

/* Initiales et couleur d'avatar d'un responsable (texte libre ou membre de l'équipe) */
export function initials(name = '') {
  const parts = String(name).replace(/[^\p{L}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#ec4899', '#eab308', '#6366f1', '#14b8a6'];
export function avatarColor(name = '') {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* Membre de l'équipe correspondant au responsable saisi (nom exact, sans tenir compte de la casse) */
export const memberFor = (team, responsible) => {
  const r = String(responsible || '').trim().toLowerCase();
  return r ? team.find(m => String(m.name || '').trim().toLowerCase() === r) : undefined;
};

/* Recherche plein texte (titre, source, responsable, notes, type) */
export function matchesSearch(d, query, typeLabel = '') {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [d.title, d.source, d.responsible, d.notes, typeLabel].some(v => String(v || '').toLowerCase().includes(q));
}
