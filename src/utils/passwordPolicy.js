/* Politique de mot de passe (miroir indicatif de la règle serveur, qui reste l'autorité).
 * policy : { min_length, min_classes } fourni par GET /auth/options */
export const DEFAULT_POLICY = { min_length: 12, min_classes: 3 };

const CLASSES = [
  ['minuscule', /[a-z]/],
  ['majuscule', /[A-Z]/],
  ['chiffre',   /[0-9]/],
  ['symbole',   /[^A-Za-z0-9]/],
];

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Fragments personnels interdits : partie locale de l'email et parties du nom (≥ 4 caractères) */
function personalParts({ email, name } = {}) {
  const parts = [];
  const local = norm(email).split('@')[0];
  if (local.length >= 4) parts.push(local);
  for (const p of norm(name).split(/[^a-z0-9]+/)) if (p.length >= 4) parts.push(p);
  return [...new Set(parts)];
}

/* Liste de toutes les règles avec leur état : [{ label, ok }] */
export function passwordRules(pwd = '', policy, ctx = {}) {
  const minLength  = Number(policy?.min_length)  || DEFAULT_POLICY.min_length;
  const minClasses = Math.min(4, Number(policy?.min_classes) || DEFAULT_POLICY.min_classes);
  const classes    = CLASSES.filter(([, re]) => re.test(pwd)).length;
  const p          = norm(pwd);
  const personal   = personalParts(ctx);
  return [
    { label: `Au moins ${minLength} caractères`, ok: pwd.length >= minLength },
    { label: `Au moins ${minClasses} types parmi : minuscule, majuscule, chiffre, symbole`, ok: classes >= minClasses },
    ...(personal.length ? [{ label: 'Ne contient ni votre nom ni votre identifiant email', ok: !!pwd && !personal.some(x => p.includes(x)) }] : []),
  ];
}

/* Messages des règles non respectées (tableau vide = mot de passe conforme) */
export function checkPassword(pwd, policy, ctx = {}) {
  return passwordRules(pwd, policy, ctx).filter(r => !r.ok).map(r => r.label);
}
