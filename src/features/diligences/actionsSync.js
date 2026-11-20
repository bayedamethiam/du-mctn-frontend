/* Actions des diligences rangées par l'API (module directives du backend), sans aucun affichage.
 *
 * La fiche, les cartes et la liste travaillent toujours sur un texte de notes qui contient les
 * actions en cases à cocher (voir actions.js). Quand l'API des actions répond, la page fait la
 * traduction :
 *   - à la lecture : withActions() reconstitue ce texte à partir des actions de l'API ;
 *   - à l'enregistrement : la diligence garde le seul texte libre, et syncActions() applique à
 *     l'API la différence entre les actions d'avant et celles de la fiche.
 * Quand l'API ne répond pas (404 : module non activé), rien de tout cela ne sert et les actions
 * restent dans les notes, comme avant. Le backend reprend lui-même ces actions dès que le module
 * est activé. */
import { cleanLabel, parseNotes, serializeNotes } from './actions.js';

/* La diligence telle que la fiche et les cartes l'attendent : texte libre + actions de l'API.
 * `_actions` garde les actions de l'API (avec leurs identifiants) pour l'enregistrement. */
export function withActions(diligence, apiActions = []) {
  const { text } = parseNotes(diligence.notes);
  const actions = [...apiActions].sort((a, b) => a.position - b.position);
  return { ...diligence, notes: serializeNotes(text, actions.map(a => ({ label: a.label, done: !!a.done }))), _actions: actions };
}

/* Différence entre les actions de l'API (`before`, avec identifiants) et celles de la fiche
 * (`after`, libellé et état). Une action garde son identifiant (et sa date de réalisation) tant que
 * son libellé ne change pas ; un libellé modifié devient une nouvelle action.
 * Renvoie { remove: [id], update: [{ id, done }], slots: [{ id } | { create: { label, done } }] }
 * où `slots` décrit l'ordre final. */
export function planSync(before, after) {
  const pool = before.map(a => ({ id: a.id, label: a.label, done: !!a.done, used: false }));
  const update = [];
  const slots = [];
  for (const a of after) {
    const label = cleanLabel(a.label);
    if (!label) continue;
    const done = !!a.done;
    const match = pool.find(o => !o.used && o.label === label);
    if (match) {
      match.used = true;
      if (match.done !== done) update.push({ id: match.id, done });
      slots.push({ id: match.id });
    } else slots.push({ create: { label, done } });
  }
  return { remove: pool.filter(o => !o.used).map(o => o.id), update, slots };
}

/* Applique la différence à l'API, puis renvoie les actions telles que l'API les a enregistrées.
 * `api` : { list, add, update, remove, reorder } (actionsApi de src/api.js). */
export async function syncActions(api, diligenceId, before, after) {
  const plan = planSync(before, after);
  for (const id of plan.remove) await api.remove(diligenceId, id);
  for (const { id, done } of plan.update) await api.update(diligenceId, id, { done });
  const ids = [];
  for (const slot of plan.slots) {
    if (slot.id !== undefined) { ids.push(slot.id); continue; }
    const created = await api.add(diligenceId, slot.create.label);
    if (slot.create.done) await api.update(diligenceId, created.id, { done: true });
    ids.push(created.id);
  }
  // Nouvel ordre seulement s'il diffère de celui de l'API (les créations arrivent en fin de liste)
  const current = (await api.list(diligenceId)).map(a => a.id);
  if (ids.length && ids.some((id, i) => current[i] !== id)) return api.reorder(diligenceId, ids);
  return api.list(diligenceId);
}

/* Regroupe les actions de l'API par diligence */
export function groupByDiligence(actions = []) {
  const by = new Map();
  for (const a of actions) {
    if (!by.has(a.diligence_id)) by.set(a.diligence_id, []);
    by.get(a.diligence_id).push(a);
  }
  return by;
}
