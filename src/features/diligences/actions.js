/* Actions (sous-tâches) d'une diligence, sans aucun affichage (fonctions pures, testables).
 *
 * L'API ne connaît pas encore les actions : elles sont rangées dans le champ texte `notes`,
 * sous forme de cases à cocher Markdown, à la suite du texte libre :
 *
 *     Réunion préparatoire avec les parties prenantes.
 *
 *     - [x] Envoyer la convocation
 *     - [ ] Préparer la note de cadrage
 *
 * Ce format reste lisible partout où les notes s'affichent telles quelles (exports, autres écrans)
 * et se convertira sans perte le jour où le backend aura une vraie table des actions.
 * Toute ligne de la forme « - [ ] … » ou « - [x] … » est une action, où qu'elle soit dans le texte. */

const ACTION_LINE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/;

let seq = 0;
/* Identifiant local (clé d'affichage), jamais envoyé au serveur */
export const newActionId = () => `a${Date.now().toString(36)}${(seq++).toString(36)}`;

/* Une seule ligne, sans espaces superflus : un retour à la ligne casserait le format */
export const cleanLabel = label => String(label || '').replace(/\s+/g, ' ').trim();

export function parseNotes(notes) {
  const text = [];
  const actions = [];
  for (const line of String(notes || '').split(/\r?\n/)) {
    const m = ACTION_LINE.exec(line);
    if (m) actions.push({ id: newActionId(), label: cleanLabel(m[2]), done: m[1] !== ' ' });
    else text.push(line);
  }
  return { text: text.join('\n').replace(/\s+$/, '').replace(/^\s*\n/, ''), actions };
}

export function serializeNotes(text, actions = []) {
  const body = String(text || '').replace(/\s+$/, '');
  const lines = actions.map(a => ({ ...a, label: cleanLabel(a.label) })).filter(a => a.label)
    .map(a => `- [${a.done ? 'x' : ' '}] ${a.label}`);
  return [body, lines.join('\n')].filter(Boolean).join('\n\n');
}

/* Avancement : { done, total, percent } (percent = 0 sans action) */
export function progress(actions = []) {
  const total = actions.length;
  const done = actions.filter(a => a.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/* Résumé d'une diligence telle que renvoyée par l'API (carte, liste) */
export function notesSummary(notes) {
  const { text, actions } = parseNotes(notes);
  return { text, actions, ...progress(actions) };
}
