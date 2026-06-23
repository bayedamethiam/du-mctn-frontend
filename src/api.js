const BASE = import.meta.env.VITE_API_URL || '/api';
let _token = localStorage.getItem('du_token') || '';
let _onUnauth = null;

export function setToken(t) {
  _token = t;
  t ? localStorage.setItem('du_token', t) : localStorage.removeItem('du_token');
}
export function setUnauthCallback(fn) { _onUnauth = fn; }
export function getToken() { return _token; }

async function request(method, path, body, isForm = false) {
  const headers = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    setToken('');
    if (_onUnauth) _onUnauth();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
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
  downloadDoc: async (id, did, name) => {
    const res = await fetch(`${BASE}/partnerships/${id}/documents/${did}/download`, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!res.ok) throw new Error('Téléchargement impossible');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
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
  revues:          type        => api.get(`/se/revues${type ? '?type=' + type : ''}`),
  createRevue:     d           => api.post('/se/revues', d),
  updateRevue:     (id, d)     => api.put(`/se/revues/${id}`, d),
  uploadRevueDoc:  (id, f, tag)=> api.upload(`/se/revues/${id}/documents`, f, { tag }),
  deleteRevueDoc:  (rid, did)  => api.delete(`/se/revues/${rid}/documents/${did}`),
  downloadRevueDoc:(rid, did, name) => {
    const a = document.createElement('a');
    a.href = `${BASE}/se/revues/${rid}/documents/${did}/download`;
    a.download = name; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  },
  evaluations:     ()          => api.get('/se/evaluations'),
  updateEvaluation:(id, d)     => api.put(`/se/evaluations/${id}`, d),
};

// Instances internationales
export const instancesApi = {
  list:               ()            => api.get('/instances'),
  get:                id            => api.get(`/instances/${id}`),
  create:             d             => api.post('/instances', d),
  update:             (id, d)       => api.put(`/instances/${id}`, d),
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

// Équipe
export const teamApi = {
  list:   ()        => api.get('/team'),
  create: d         => api.post('/team', d),
  update: (id, d)   => api.put(`/team/${id}`, d),
  delete: id        => api.delete(`/team/${id}`),
};
