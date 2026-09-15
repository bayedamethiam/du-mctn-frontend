// Miroir de ROLE_HIERARCHY / authorizeRoles côté backend (middleware/auth.js) :
// un rôle est autorisé si son niveau est >= au plus bas des rôles listés.
export const ROLE_LEVEL = { admin: 8, director: 7, coordinator: 6, analyst: 5 };

export const can = (user, ...roles) => {
  const lvl = ROLE_LEVEL[user?.role] || 0;
  return lvl > 0 && lvl >= Math.min(...roles.map(r => ROLE_LEVEL[r] || 99));
};

export const isAdmin = user => user?.role === 'admin';
