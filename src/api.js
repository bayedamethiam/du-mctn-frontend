const BASE = import.meta.env.VITE_API_URL || '/api';
let _token = localStorage.getItem('du_token') || '';
let _onUnauth = null;

export function setToken(t) {
  _token = t;
  t ? localStorage.setItem('du_token', t) : localStorage.removeItem('du_token');
}
export function setUnauthCallback(fn) { _onUnauth = fn; }
export function getToken() { return _token; }

// Routes publiques : un 401 y signifie « refusé », pas « session expirée » (ni refresh ni déconnexion)
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/mfa/verify', '/auth/forgot-password', '/auth/reset-password', '/auth/options'];
let _refreshing = null;

/* Renouvelle l'access token avec le refresh token (un seul appel concurrent).
 * Rotation : le serveur renvoie un nouveau refresh token qui remplace l'ancien. */
async function tryRefresh() {
  const rt = localStorage.getItem('du_refresh');
  if (!rt) return false;
  _refreshing ||= fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d?.accessToken) return false;
      setToken(d.accessToken);
      if (d.refreshToken) localStorage.setItem('du_refresh', d.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => { setTimeout(() => { _refreshing = null; }, 0); });
  return _refreshing;
}

async function rawFetch(method, path, body, isForm) {
  const headers = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${path}`, { method, headers, body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined });
}

/* 401 sur une route protégée = session expirée → tentative de refresh, sinon déconnexion.
 * 401 sur login = identifiants incorrects (message du serveur). 403 = droits insuffisants. */
async function authFetch(method, path, body, isForm = false) {
  let res = await rawFetch(method, path, body, isForm);
  if (res.status === 401 && !PUBLIC_PATHS.includes(path)) {
    if (await tryRefresh()) res = await rawFetch(method, path, body, isForm);
    if (res.status === 401) {
      setToken('');
      localStorage.removeItem('du_refresh');
      if (_onUnauth) _onUnauth();
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
  }
  return res;
}

async function request(method, path, body, isForm = false) {
  const res  = await authFetch(method, path, body ?? undefined, isForm);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 403 « droit insuffisant » : message uniforme, quel que soit l'écran qui l'affiche
    const forbidden = res.status === 403 && data.code === 'FORBIDDEN';
    const err = new Error(forbidden ? 'Votre rôle ne permet pas cette action.' : (data.error || `Erreur ${res.status}`));
    err.status = res.status;
    err.data   = data;
    // 403 bloquants tant que le mot de passe n'est pas changé / la 2FA pas configurée
    if (res.status === 403 && (data.code === 'MFA_SETUP_REQUIRED' || data.code === 'PASSWORD_CHANGE_REQUIRED')) err.code = data.code;
    throw err;
  }
  return data;
}

/* Téléchargement authentifié d'un fichier (les fichiers ne sont pas servis publiquement) */
export async function downloadFile(path, name) {
  const res = await authFetch('GET', path);
  if (!res.ok) throw new Error('Téléchargement impossible');
  const url = URL.createObjectURL(await res.blob());
  const a   = document.createElement('a');
  a.href = url; a.download = name || 'document';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get:    path       => request('GET',    path),
  post:   (path, b)  => request('POST',   path, b),
  put:    (path, b)  => request('PUT',    path, b),
  patch:  (path, b)  => request('PATCH',  path, b),
  delete: path       => request('DELETE', path),
  upload: (path, file, fields = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    return request('POST', path, fd, true);
  },
};

// Auth
export const authApi = {
  login:          (email, password) => request('POST', '/auth/login', { email, password }),
  logout:         rt                => request('POST', '/auth/logout', { refreshToken: rt }),
  me:             ()                => request('GET',  '/auth/me'),
  refresh:        rt                => request('POST', '/auth/refresh', { refreshToken: rt }),
  changePassword: (cur, nxt)        => request('POST', '/auth/change-password', { currentPassword: cur, newPassword: nxt }),
  // Public
  options:        ()                => request('GET',  '/auth/options'),
  verifyMfa:      (mfaToken, code)  => request('POST', '/auth/mfa/verify', { mfaToken, code }),
  forgotPassword: email             => request('POST', '/auth/forgot-password', { email }),
  resetPassword:  (token, password) => request('POST', '/auth/reset-password', { token, password }),
  // Double authentification
  mfaSetup:                ()               => request('POST', '/auth/mfa/setup'),
  mfaEnable:               code             => request('POST', '/auth/mfa/enable', { code }),
  mfaDisable:              (password, code) => request('POST', '/auth/mfa/disable', { password, code }),
  regenerateRecoveryCodes: code             => request('POST', '/auth/mfa/recovery-codes', { code }),
  // Sessions
  sessions:            ()  => request('GET',    '/auth/sessions'),
  revokeSession:       id  => request('DELETE', `/auth/sessions/${id}`),
  revokeOtherSessions: ()  => request('POST',   '/auth/sessions/revoke-others'),
};

// Dashboard
export const dashboardApi = {
  kpis:   () => api.get('/dashboard/kpis'),
  alerts: () => api.get('/dashboard/alerts'),
};

// Axes
export const axesApi = {
  list:   ()        => api.get('/axes'),
  create: d         => api.post('/axes', d),
  update: (id, d)   => api.put(`/axes/${id}`, d),
  delete: id        => api.delete(`/axes/${id}`),
};

// Programs
export const programsApi = {
  list:          ()         => api.get('/programs'),
  get:           id         => api.get(`/programs/${id}`),
  create:        d          => api.post('/programs', d),
  update:        (id, d)    => api.put(`/programs/${id}`, d),
  delete:        id         => api.delete(`/programs/${id}`),
  allProjects:   ()         => api.get('/programs/all-projects'),
  listProjects:  id         => api.get(`/programs/${id}/projects`),
  createProject: (id, d)    => api.post(`/programs/${id}/projects`, d),
  updateProject: (pid, d)   => api.put(`/programs/projects/${pid}`, d),
  deleteProject: pid        => api.delete(`/programs/projects/${pid}`),
};

// Diligences
export const diligencesApi = {
  list:         (p = {}) => api.get('/diligences?' + new URLSearchParams(p)),
  get:          id       => api.get(`/diligences/${id}`),
  create:       d        => api.post('/diligences', d),
  update:       (id, d)  => api.put(`/diligences/${id}`, d),
  updateStatus: (id, s)  => api.patch(`/diligences/${id}/status`, { status: s }),
  delete:       id       => api.delete(`/diligences/${id}`),
};

// Partnerships
export const partnershipsApi = {
  list:        ()             => api.get('/partnerships'),
  get:         id             => api.get(`/partnerships/${id}`),
  create:      d              => api.post('/partnerships', d),
  update:      (id, d)        => api.put(`/partnerships/${id}`, d),
  delete:      id             => api.delete(`/partnerships/${id}`),
  uploadDoc:   (id, file)     => api.upload(`/partnerships/${id}/documents`, file),
  deleteDoc:   (id, did)      => api.delete(`/partnerships/${id}/documents/${did}`),
  downloadDoc: (id, did, name) => downloadFile(`/partnerships/${id}/documents/${did}/download`, name),
};

// Audiences
export const audiencesApi = {
  list:         (p = {}) => api.get('/audiences?' + new URLSearchParams(p)),
  get:          id       => api.get(`/audiences/${id}`),
  create:       d        => api.post('/audiences', d),
  update:       (id, d)  => api.put(`/audiences/${id}`, d),
  updateStatus: (id, s)  => api.patch(`/audiences/${id}/status`, { status: s }),
  delete:       id       => api.delete(`/audiences/${id}`),
};

// Suivi-Évaluation
export const seApi = {
  stats:           ()          => api.get('/se/stats'),
  indicators:      ()          => api.get('/se/indicators'),
  updateIndicator: (id, d)     => api.put(`/se/indicators/${id}`, d),
  createIndicator: d           => api.post('/se/indicators', d),
  deleteIndicator: id          => api.delete(`/se/indicators/${id}`),
  setMilestones:   (id, list)  => api.put(`/se/indicators/${id}/milestones`, { milestones: list }),
  revues:          type        => api.get(`/se/revues${type ? '?type=' + type : ''}`),
  createRevue:     d           => api.post('/se/revues', d),
  updateRevue:     (id, d)     => api.put(`/se/revues/${id}`, d),
  uploadRevueDoc:  (id, f, tag)=> api.upload(`/se/revues/${id}/documents`, f, { tag }),
  deleteRevueDoc:  (rid, did)  => api.delete(`/se/revues/${rid}/documents/${did}`),
  downloadRevueDoc:(rid, did, name) => downloadFile(`/se/revues/${rid}/documents/${did}/download`, name),
  evaluations:        ()       => api.get('/se/evaluations'),
  createEvaluation:   d        => api.post('/se/evaluations', d),
  updateEvaluation:   (id, d)  => api.put(`/se/evaluations/${id}`, d),
  deleteEvaluation:   id       => api.delete(`/se/evaluations/${id}`),
  deleteRevue:        id       => api.delete(`/se/revues/${id}`),
};

// Instances internationales
export const instancesApi = {
  list:               ()            => api.get('/instances'),
  get:                id            => api.get(`/instances/${id}`),
  create:             d             => api.post('/instances', d),
  update:             (id, d)       => api.put(`/instances/${id}`, d),
  delete:             id            => api.delete(`/instances/${id}`),
  createContribution: (id, d)       => api.post(`/instances/${id}/contributions`, d),
  updateContribution: (id, cid, d)  => api.put(`/instances/${id}/contributions/${cid}`, d),
  deleteContribution: (id, cid)     => api.delete(`/instances/${id}/contributions/${cid}`),
};

// Project meetings
export const projectMeetingsApi = {
  all:    ()         => api.get('/project-meetings/all'),
  list:   projectId  => api.get(`/project-meetings/${projectId}`),
  create: (pid, d)   => api.post(`/project-meetings/${pid}`, d),
  update: (id, d)    => api.put(`/project-meetings/entry/${id}`, d),
  delete: id         => api.delete(`/project-meetings/entry/${id}`),
};

// Événements internationaux / nationaux / régionaux
export const intlEventsApi = {
  list:   ()        => api.get('/intl-events'),
  create: d         => api.post('/intl-events', d),
  update: (id, d)   => api.put(`/intl-events/${id}`, d),
  delete: id        => api.delete(`/intl-events/${id}`),
};

// Workflow templates
export const workflowTemplatesApi = {
  list:   ()        => api.get('/workflow-templates'),
  create: d         => api.post('/workflow-templates', d),
  update: (id, d)   => api.put(`/workflow-templates/${id}`, d),
  delete: id        => api.delete(`/workflow-templates/${id}`),
};

// Référentiels (listes paramétrables)
export const refApi = {
  list:   ()        => api.get('/ref'),
  create: d         => api.post('/ref', d),
  update: (id, d)   => api.put(`/ref/${id}`, d),
  delete: id        => api.delete(`/ref/${id}`),
};

// Rôles & droits
export const rolesApi = {
  list:        ()       => api.get('/roles'),
  permissions: ()       => api.get('/roles/permissions'),
  create:      d        => api.post('/roles', d),
  update:      (id, d)  => api.put(`/roles/${id}`, d),
  delete:      id       => api.delete(`/roles/${id}`),
};

// Paramètres de l'organisation
export const settingsApi = {
  public: ()  => api.get('/settings/public'),
  all:    ()  => api.get('/settings'),
  update: d   => api.put('/settings', d),
};

// Utilisateurs (administration)
export const usersApi = {
  list:          ()        => api.get('/auth/users'),
  create:        d         => api.post('/auth/users', d),
  update:        (id, d)   => api.put(`/auth/users/${id}`, d),
  resetPassword: (id, pwd) => api.post(`/auth/users/${id}/reset-password`, { password: pwd }),
  unlock:         id       => api.post(`/auth/users/${id}/unlock`),
  resetMfa:       id       => api.post(`/auth/users/${id}/mfa-reset`),
  revokeSessions: id       => api.post(`/auth/users/${id}/revoke-sessions`),
  invite:         id       => api.post(`/auth/users/${id}/invite`),
  delete:         id       => api.delete(`/auth/users/${id}`),
  loginEvents:    (p = {}) => api.get('/auth/login-events?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null))),
};

// Équipe
export const teamApi = {
  list:   ()        => api.get('/team'),
  create: d         => api.post('/team', d),
  update: (id, d)   => api.put(`/team/${id}`, d),
  delete: id        => api.delete(`/team/${id}`),
};
