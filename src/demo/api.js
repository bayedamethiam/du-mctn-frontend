import * as D from './data.js';

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
const ok = data => Promise.resolve(data);

export const authApi = {
  login:  async () => { await delay(); return { accessToken: 'demo', refreshToken: 'demo', user: D.DEMO_USER }; },
  logout: async () => {},
  me:     async () => D.DEMO_USER,
  refresh: async () => ({ accessToken: 'demo' }),
  changePassword: async () => {},
};

export const dashboardApi = {
  kpis:   async () => { await delay(200); return D.DEMO_DASHBOARD_KPIS; },
  alerts: async () => { await delay(200); return D.DEMO_ALERTS; },
};

export const axesApi = {
  list:   async () => { await delay(); return D.DEMO_AXES; },
  create: async d  => { await delay(); return { ...d, id: Date.now() }; },
  update: async (id, d) => ({ ...d, id }),
  delete: async () => {},
};

export const programsApi = {
  list:          async () => { await delay(); return D.DEMO_PROGRAMS; },
  get:           async id  => D.DEMO_PROGRAMS.find(p => p.id === +id) || D.DEMO_PROGRAMS[0],
  allProjects:   async ()  => { await delay(); return D.DEMO_ALL_PROJECTS; },
  listProjects:  async id  => D.DEMO_ALL_PROJECTS.filter(p => p.program_id === +id),
  create:        async d   => { await delay(); return { ...d, id: Date.now(), project_count: 0 }; },
  update:        async (id, d) => ({ ...d, id }),
  delete:        async () => {},
  createProject: async (id, d) => ({ ...d, id: Date.now(), program_id: id }),
  updateProject: async (pid, d) => ({ ...d, id: pid }),
  deleteProject: async () => {},
};

export const diligencesApi = {
  list:         async () => { await delay(); return D.DEMO_DILIGENCES; },
  get:          async id  => D.DEMO_DILIGENCES.find(d => d.id === +id),
  create:       async d   => { await delay(); return { ...d, id: Date.now(), created_at: new Date().toISOString() }; },
  update:       async (id, d) => ({ ...d, id }),
  updateStatus: async (id, s) => ({ id, status: s }),
  delete:       async () => {},
};

export const partnershipsApi = {
  list:        async () => { await delay(); return D.DEMO_PARTNERSHIPS; },
  get:         async id  => D.DEMO_PARTNERSHIPS.find(p => p.id === +id),
  create:      async d   => ({ ...d, id: Date.now() }),
  update:      async (id, d) => ({ ...d, id }),
  delete:      async () => {},
  uploadDoc:   async () => ({ id: Date.now(), name: 'document.pdf' }),
  deleteDoc:   async () => {},
  downloadDoc: async () => {},
};

export const audiencesApi = {
  list:         async () => { await delay(); return D.DEMO_AUDIENCES; },
  get:          async id  => D.DEMO_AUDIENCES.find(a => a.id === +id),
  create:       async d   => ({ ...d, id: Date.now() }),
  update:       async (id, d) => ({ ...d, id }),
  updateStatus: async (id, s) => ({ id, status: s }),
  delete:       async () => {},
};

export const seApi = {
  stats:           async () => { await delay(); return D.DEMO_SE_STATS; },
  indicators:      async () => { await delay(); return D.DEMO_INDICATORS; },
  updateIndicator: async (id, d) => ({ ...d, id }),
  revues:          async () => { await delay(); return D.DEMO_REVUES; },
  createRevue:     async d  => ({ ...d, id: Date.now() }),
  updateRevue:     async (id, d) => ({ ...d, id }),
  uploadRevueDoc:  async () => {},
  deleteRevueDoc:  async () => {},
  downloadRevueDoc: () => {},
  evaluations:     async () => [],
  updateEvaluation: async (id, d) => ({ ...d, id }),
};

export const instancesApi = {
  list:               async () => { await delay(); return D.DEMO_INSTANCES; },
  get:                async id  => D.DEMO_INSTANCES.find(i => i.id === +id),
  create:             async d   => ({ ...d, id: Date.now() }),
  update:             async (id, d) => ({ ...d, id }),
  createContribution: async (id, d) => ({ ...d, id: Date.now() }),
  updateContribution: async (id, cid, d) => ({ ...d, id: cid }),
  deleteContribution: async () => {},
};

export const projectMeetingsApi = {
  all:    async () => [],
  list:   async () => [],
  create: async (pid, d) => ({ ...d, id: Date.now() }),
  update: async (id, d)  => ({ ...d, id }),
  delete: async () => {},
};

export const intlEventsApi = {
  list:   async () => { await delay(); return D.DEMO_INTL_EVENTS; },
  create: async d  => ({ ...d, id: Date.now() }),
  update: async (id, d) => ({ ...d, id }),
  delete: async () => {},
};

export const workflowTemplatesApi = {
  list:   async () => [],
  create: async d  => ({ ...d, id: Date.now() }),
  update: async (id, d) => ({ ...d, id }),
  delete: async () => {},
};

export const teamApi = {
  list:   async () => { await delay(); return D.DEMO_TEAM; },
  create: async d  => ({ ...d, id: Date.now() }),
  update: async (id, d) => ({ ...d, id }),
  delete: async () => {},
};
