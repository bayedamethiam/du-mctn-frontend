/* Droits de l'utilisateur connecté.
 * Depuis l'ouverture des rôles à la configuration, l'autorisation repose sur des clés de droits
 * (user.permissions, renvoyé par GET /auth/me) et non plus sur une hiérarchie de rôles. */

// Conservé pour compatibilité : hiérarchie des rôles fournis par défaut (API antérieure)
export const ROLE_LEVEL = { admin: 8, director: 7, coordinator: 6, analyst: 5 };

export const can = (user, ...roles) => {
  const lvl = ROLE_LEVEL[user?.role] || 0;
  return lvl > 0 && lvl >= Math.min(...roles.map(r => ROLE_LEVEL[r] || 99));
};

export const isAdmin = user => user?.role === 'admin';

/* Droits ouvrant l'écran Administration (au moins l'un d'eux) */
export const ADMIN_PERMS = ['users.read', 'users.manage', 'roles.manage', 'ref.manage', 'settings.manage', 'audit.read'];

/* Repli si l'API ne renvoie pas encore user.permissions : rôle minimal historique de chaque droit
 * (miroir des rôles par défaut du backend, lib/permissions.js). Un droit absent = réservé à l'admin. */
const LEGACY_MIN_ROLE = {
  'projects.create': 'analyst', 'projects.update': 'analyst', 'meetings.manage': 'analyst',
  'diligences.manage': 'analyst', 'audiences.manage': 'analyst', 'partnerships.docs': 'analyst',
  'revues.docs': 'analyst', 'revues.docs.delete': 'coordinator', 'indicators.update': 'analyst', 'contributions.manage': 'analyst',
  'programs.update': 'coordinator', 'templates.manage': 'coordinator', 'meetings.delete': 'coordinator',
  'indicators.manage': 'coordinator', 'revues.manage': 'coordinator', 'partnerships.manage': 'coordinator',
  'partnerships.docs.delete': 'coordinator', 'instances.manage': 'coordinator', 'contributions.delete': 'coordinator',
  'events.manage': 'coordinator', 'events.delete': 'coordinator',
  'programs.create': 'director', 'programs.delete': 'director', 'projects.delete': 'director',
  'axes.manage': 'director', 'templates.delete': 'director', 'diligences.delete': 'director',
  'audiences.delete': 'director', 'partnerships.delete': 'director', 'evaluations.manage': 'director',
  'instances.delete': 'director', 'team.manage': 'director', 'team.delete': 'director',
  'ref.manage': 'director', 'settings.manage': 'director', 'users.read': 'director', 'audit.read': 'director',
  'users.manage': 'admin', 'roles.manage': 'admin',
};

/* Vrai si l'utilisateur possède au moins un des droits demandés ('*' = tous les droits) */
export const hasPerm = (user, ...keys) => {
  if (!user || !keys.length) return false;
  const perms = user.permissions;
  if (Array.isArray(perms)) return perms.includes('*') || keys.some(k => perms.includes(k));
  return keys.some(k => can(user, LEGACY_MIN_ROLE[k] || 'admin'));
};
