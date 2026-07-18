// ── Données fictives pour le mode démo ──────────────────────────────────────

export const DEMO_USER = {
  id: 'demo', name: 'Aminata Sow', email: 'a.sow@mctn.sn',
  role: 'admin', department: 'Direction',
};

export const DEMO_USERS = [
  { id: 'usr_1', name: 'Mohamed Diaby',   email: 'm.diaby@mctn.sn',   role: 'admin',       department: 'Direction',   phone: '+221770000001' },
  { id: 'usr_2', name: 'Fatou Diallo',    email: 'f.diallo@mctn.sn',  role: 'coordinator', department: 'Projets',     phone: '+221770000002' },
  { id: 'usr_3', name: 'Ibrahima Sarr',   email: 'i.sarr@mctn.sn',    role: 'analyst',     department: 'S&E',         phone: '+221770000003' },
  { id: 'usr_4', name: 'Aminata Ndiaye',  email: 'a.ndiaye@mctn.sn',  role: 'analyst',     department: 'DPI',         phone: '+221770000004' },
  { id: 'usr_5', name: 'Oumar Fall',      email: 'o.fall@mctn.sn',    role: 'analyst',     department: 'e-Gov',       phone: '+221770000005' },
];

export const DEMO_AXES = [
  { id: 1, name: 'Gouvernance & Régulation du Numérique',      color: '#3B82F6' },
  { id: 2, name: 'Infrastructure & Connectivité',               color: '#10B981' },
  { id: 3, name: 'Transformation Numérique Sectorielle',        color: '#8B5CF6' },
  { id: 4, name: 'Économie Numérique & Innovation',             color: '#F59E0B' },
];

export const DEMO_PROGRAMS = [
  { id: 1,  code: 'P01', name: 'Gouvernance & Régulation du Numérique', axe_id: 1, status: 'on_track',  progress: 65, budget: 2500000000, project_count: 5 },
  { id: 2,  code: 'P02', name: 'Infrastructure & Connectivité Nationale', axe_id: 2, status: 'on_track',  progress: 58, budget: 8000000000, project_count: 6 },
  { id: 3,  code: 'P03', name: 'Cybersécurité & Confiance Numérique',    axe_id: 1, status: 'attention', progress: 34, budget: 1800000000, project_count: 4 },
  { id: 4,  code: 'P04', name: 'e-Gouvernement & Services Publics',      axe_id: 3, status: 'on_track',  progress: 72, budget: 3200000000, project_count: 7 },
  { id: 5,  code: 'P05', name: 'Éducation & Formation au Numérique',     axe_id: 3, status: 'on_track',  progress: 50, budget: 2000000000, project_count: 5 },
  { id: 6,  code: 'P06', name: 'Santé Numérique',                        axe_id: 3, status: 'attention', progress: 28, budget: 1500000000, project_count: 3 },
  { id: 7,  code: 'P07', name: 'Agriculture Numérique',                  axe_id: 3, status: 'on_track',  progress: 45, budget: 1200000000, project_count: 4 },
  { id: 8,  code: 'P08', name: 'Finance & Inclusion Numérique',          axe_id: 4, status: 'on_track',  progress: 61, budget: 1800000000, project_count: 5 },
  { id: 9,  code: 'P09', name: 'Innovation, Startups & Écosystème',      axe_id: 4, status: 'attention', progress: 22, budget: 900000000,  project_count: 3 },
  { id: 10, code: 'P10', name: 'Économie Numérique & Commerce',          axe_id: 4, status: 'on_track',  progress: 39, budget: 1400000000, project_count: 4 },
  { id: 11, code: 'P11', name: 'Industrie Numérique & Compétitivité',    axe_id: 4, status: 'attention', progress: 18, budget: 1100000000, project_count: 3 },
  { id: 12, code: 'P12', name: 'Coopération Internationale Numérique',   axe_id: 1, status: 'on_track',  progress: 55, budget: 700000000,  project_count: 3 },
];

export const DEMO_ALL_PROJECTS = [
  { id: 1,  program_id: 1, code: 'P01-PR1', name: 'Révision cadre légal télécoms',         status: 'on_track',  progress: 80 },
  { id: 2,  program_id: 1, code: 'P01-PR2', name: "Réforme de l'ARTP",                     status: 'on_track',  progress: 60 },
  { id: 3,  program_id: 1, code: 'P01-PR3', name: 'Politique nationale données personnelles', status: 'attention', progress: 40 },
  { id: 4,  program_id: 2, code: 'P02-PR1', name: 'Fibre optique nationale (backbone)',      status: 'on_track',  progress: 55 },
  { id: 5,  program_id: 2, code: 'P02-PR2', name: 'Couverture 4G zones rurales',             status: 'on_track',  progress: 48 },
  { id: 6,  program_id: 2, code: 'P02-PR3', name: 'Data centers souverains',                 status: 'attention', progress: 30 },
  { id: 7,  program_id: 3, code: 'P03-PR1', name: 'CERT National Sénégal',                  status: 'on_track',  progress: 70 },
  { id: 8,  program_id: 3, code: 'P03-PR2', name: 'Stratégie nationale cybersécurité',      status: 'attention', progress: 25 },
  { id: 9,  program_id: 4, code: 'P04-PR1', name: 'Portail unique services publics (e-Gov)', status: 'on_track',  progress: 85 },
  { id: 10, program_id: 4, code: 'P04-PR2', name: 'Identité numérique citoyenne',           status: 'on_track',  progress: 65 },
  { id: 11, program_id: 5, code: 'P05-PR1', name: 'Programme ordinateurs pour écoles',      status: 'on_track',  progress: 60 },
  { id: 12, program_id: 5, code: 'P05-PR2', name: 'Formation enseignants au numérique',     status: 'on_track',  progress: 45 },
  { id: 13, program_id: 6, code: 'P06-PR1', name: 'Dossier médical électronique national',  status: 'attention', progress: 20 },
  { id: 14, program_id: 7, code: 'P07-PR1', name: 'Plateforme agri-numérique',              status: 'on_track',  progress: 50 },
  { id: 15, program_id: 8, code: 'P08-PR1', name: 'Interopérabilité systèmes paiement',     status: 'on_track',  progress: 70 },
];

export const DEMO_DILIGENCES = [
  { id: 1, title: 'Réponse à la commission communication',    source: 'Assemblée Nationale', deadline: '2025-09-30', status: 'en_cours', responsible: 'M. Diaby',   priority: 'haute',  type: 'Note' },
  { id: 2, title: 'Rapport bilan déploiement fibre optique', source: 'Présidence',           deadline: '2025-10-15', status: 'planifié', responsible: 'F. Diallo',  priority: 'haute',  type: 'Rapport' },
  { id: 3, title: 'Avis sur projet de loi cybersécurité',    source: 'Primature',            deadline: '2025-08-20', status: 'fait',     responsible: 'I. Sarr',    priority: 'haute',  type: 'Avis' },
  { id: 4, title: 'Contribution stratégie IA nationale',     source: 'MESRI',                deadline: '2025-11-30', status: 'planifié', responsible: 'A. Ndiaye',  priority: 'moyenne', type: 'Note' },
  { id: 5, title: 'Suivi accord partenariat Huawei',         source: 'Direction MTN',        deadline: '2025-09-01', status: 'en_cours', responsible: 'O. Fall',    priority: 'haute',  type: 'Suivi' },
  { id: 6, title: 'Préparation réunion UEMOA numérique',     source: 'Coopération',          deadline: '2025-10-05', status: 'planifié', responsible: 'M. Diaby',   priority: 'moyenne', type: 'Note' },
  { id: 7, title: 'Rapport Q2 2025 programme e-Gov',         source: 'DU Interne',           deadline: '2025-07-31', status: 'fait',     responsible: 'F. Diallo',  priority: 'basse',  type: 'Rapport' },
  { id: 8, title: 'Note sur la régulation des plateformes',  source: 'Cabinet Ministre',     deadline: '2025-12-15', status: 'planifié', responsible: 'I. Sarr',    priority: 'moyenne', type: 'Note' },
];

export const DEMO_PARTNERSHIPS = [
  { id: 1, name: 'Banque Mondiale',          type: 'Multilatéral', status: 'actif',    domain: 'Infrastructure', signed_date: '2024-01-15', amount: 50000000,  currency: 'USD', focal_point: 'A. Camara' },
  { id: 2, name: 'Union Européenne',         type: 'Multilatéral', status: 'actif',    domain: 'e-Gouvernement', signed_date: '2024-03-20', amount: 15000000,  currency: 'EUR', focal_point: 'M. Diaby' },
  { id: 3, name: 'Huawei Technologies',      type: 'Privé',        status: 'actif',    domain: 'Connectivité',   signed_date: '2023-11-10', amount: 30000000,  currency: 'USD', focal_point: 'O. Fall' },
  { id: 4, name: 'Agence Française de Dev.', type: 'Bilatéral',    status: 'actif',    domain: 'Formation',      signed_date: '2024-06-01', amount: 8000000,   currency: 'EUR', focal_point: 'F. Diallo' },
  { id: 5, name: 'PNUD Sénégal',             type: 'Multilatéral', status: 'actif',    domain: 'Innovation',     signed_date: '2024-02-28', amount: 3500000,   currency: 'USD', focal_point: 'A. Ndiaye' },
  { id: 6, name: 'Microsoft Africa',         type: 'Privé',        status: 'en_cours', domain: 'Cloud & IA',     signed_date: '2025-01-10', amount: 5000000,   currency: 'USD', focal_point: 'I. Sarr' },
  { id: 7, name: 'BAD (Banque Africaine)',   type: 'Multilatéral', status: 'actif',    domain: 'Cybersécurité',  signed_date: '2023-09-15', amount: 12000000,  currency: 'USD', focal_point: 'M. Diaby' },
  { id: 8, name: 'Corée du Sud (KOICA)',     type: 'Bilatéral',    status: 'en_cours', domain: 'e-Gouvernement', signed_date: '2025-03-01', amount: 7000000,   currency: 'USD', focal_point: 'F. Diallo' },
];

export const DEMO_AUDIENCES = [
  { id: 1, institution: 'Google Africa',          date: '2025-07-10', purpose: 'Partenariat IA & Cloud',           participants: ['M. Diaby', 'O. Fall'],        status: 'tenu',    follow_up: 'Rédaction MOU en cours' },
  { id: 2, institution: 'Délégation UE à Dakar',  date: '2025-07-18', purpose: 'Point programme e-Gov',            participants: ['M. Diaby', 'F. Diallo'],      status: 'tenu',    follow_up: 'Rapport transmis' },
  { id: 3, institution: 'Orange Sénégal',         date: '2025-07-25', purpose: 'Suivi déploiement 4G rurale',      participants: ['I. Sarr'],                   status: 'planifié', follow_up: null },
  { id: 4, institution: 'Ministère Finances',     date: '2025-08-05', purpose: 'Budget NDT 2026',                  participants: ['M. Diaby', 'A. Ndiaye'],      status: 'planifié', follow_up: null },
  { id: 5, institution: 'Startup Sénégal',        date: '2025-06-28', purpose: 'État des lieux écosystème tech',   participants: ['F. Diallo', 'O. Fall'],       status: 'tenu',    follow_up: 'En attente de rapport' },
  { id: 6, institution: 'ARTP',                   date: '2025-08-12', purpose: 'Révision fréquences 5G',           participants: ['M. Diaby', 'I. Sarr'],        status: 'planifié', follow_up: null },
];

export const DEMO_TEAM = [
  { id: 1, name: 'Mohamed Diaby',  title: 'Directeur DU-MTN',              department: 'Direction',   email: 'm.diaby@mctn.sn',  phone: '+221770000001', pole: 'Direction' },
  { id: 2, name: 'Fatou Diallo',   title: 'Coordinatrice Programmes',      department: 'Projets',     email: 'f.diallo@mctn.sn', phone: '+221770000002', pole: 'Coordination' },
  { id: 3, name: 'Ibrahima Sarr',  title: 'Analyste Suivi-Évaluation',    department: 'S&E',         email: 'i.sarr@mctn.sn',   phone: '+221770000003', pole: 'Suivi & Évaluation' },
  { id: 4, name: 'Aminata Ndiaye', title: 'Analyste Partenariats',         department: 'DPI',         email: 'a.ndiaye@mctn.sn', phone: '+221770000004', pole: 'Partenariats & Coopération' },
  { id: 5, name: 'Oumar Fall',     title: 'Expert e-Gouvernement',         department: 'e-Gov',       email: 'o.fall@mctn.sn',   phone: '+221770000005', pole: 'Transformation Numérique' },
  { id: 6, name: 'Rokhaya Ba',     title: 'Assistante de Direction',       department: 'Secrétariat', email: 'r.ba@mctn.sn',     phone: '+221770000006', pole: 'Direction' },
];

export const DEMO_SE_STATS = {
  avg_progress: 42,
  by_status: { on_track: 7, attention: 3, risque: 2 },
  total_indicators: 12,
};

export const DEMO_INDICATORS = [
  { id: 1, name: 'Taux de couverture Internet national',         category: 'Connectivité',    baseline: 45, target: 80, current: 58, unit: '%',  status: 'on_track' },
  { id: 2, name: 'Nombre de services publics en ligne',          category: 'e-Gov',           baseline: 12, target: 50, current: 28, unit: 'svcs', status: 'on_track' },
  { id: 3, name: 'Taux de pénétration mobile money',            category: 'Finance',          baseline: 42, target: 75, current: 61, unit: '%',  status: 'on_track' },
  { id: 4, name: 'Nombre de startups tech labellisées',          category: 'Innovation',      baseline: 30, target: 200, current: 67, unit: 'startups', status: 'attention' },
  { id: 5, name: 'Indice e-gouvernement (ONU)',                  category: 'e-Gov',           baseline: 0.35, target: 0.65, current: 0.48, unit: 'score', status: 'on_track' },
  { id: 6, name: 'Bande passante internet disponible',           category: 'Connectivité',    baseline: 120, target: 500, current: 210, unit: 'Gbps', status: 'attention' },
  { id: 7, name: 'Taux d\'alphabétisation numérique',           category: 'Formation',        baseline: 18, target: 60, current: 26, unit: '%',  status: 'risque' },
  { id: 8, name: 'Nombre d\'incidents cyber traités',            category: 'Cybersécurité',   baseline: 0, target: 500, current: 187, unit: 'incidents', status: 'on_track' },
  { id: 9, name: 'Investissements privés secteur numérique',     category: 'Économie',        baseline: 150, target: 600, current: 280, unit: 'M FCFA', status: 'on_track' },
  { id: 10, name: 'Fibre déployée (km backbone national)',       category: 'Infrastructure',  baseline: 1200, target: 5000, current: 2100, unit: 'km', status: 'attention' },
  { id: 11, name: 'Part numérique dans le PIB',                  category: 'Économie',        baseline: 6.5, target: 15, current: 8.2, unit: '%',  status: 'on_track' },
  { id: 12, name: 'Dossiers médicaux électroniques actifs',      category: 'Santé',           baseline: 0, target: 2000000, current: 85000, unit: 'dossiers', status: 'risque' },
];

export const DEMO_REVUES = [
  { id: 1, title: 'Revue Annuelle NDT 2024',    type: 'annuelle',    date: '2024-12-15', status: 'terminé',   summary: 'Bilan positif de la première année. 68% des jalons atteints.' },
  { id: 2, title: 'Revue Semestrielle S1 2025', type: 'semestrielle', date: '2025-06-30', status: 'terminé',   summary: 'Accélération notable sur les axes Infrastructure et e-Gov.' },
  { id: 3, title: 'Revue Semestrielle S2 2025', type: 'semestrielle', date: '2025-12-15', status: 'planifié',  summary: null },
];

export const DEMO_INSTANCES = [
  { id: 1, name: 'Smart Africa',                    type: 'Organisation', role: 'Membre', contribution_count: 3, description: 'Alliance continentale pour la transformation numérique de l\'Afrique' },
  { id: 2, name: 'UEMOA — Commission Numérique',    type: 'Régional',     role: 'Membre', contribution_count: 5, description: 'Harmonisation des politiques numériques dans l\'espace UEMOA' },
  { id: 3, name: 'UIT (Union Intern. Télécom.)',    type: 'Onusien',      role: 'Membre', contribution_count: 2, description: 'Participation aux travaux sur l\'IA et la 5G' },
  { id: 4, name: 'Forum sur la Gouvernance Internet', type: 'Forum',     role: 'Observateur', contribution_count: 1, description: 'Participation aux délibérations sur la gouvernance de l\'IA' },
  { id: 5, name: 'Partenariat Sénégal-Corée',       type: 'Bilatéral',   role: 'Coordinateur', contribution_count: 4, description: 'Programme d\'assistance technique en e-gouvernement' },
];

export const DEMO_INTL_EVENTS = [
  { id: 1, title: 'Forum IA Afrique 2025',              type: 'international', date: '2025-09-15', location: 'Kigali, Rwanda',    status: 'planifié', delegate: 'M. Diaby' },
  { id: 2, title: 'Conférence UIT Genève',              type: 'international', date: '2025-10-20', location: 'Genève, Suisse',    status: 'planifié', delegate: 'O. Fall' },
  { id: 3, title: 'Sommet Smart Africa Dakar',          type: 'régional',      date: '2025-08-05', location: 'Dakar, Sénégal',    status: 'terminé',  delegate: 'M. Diaby' },
  { id: 4, title: 'UEMOA — Réunion Numérique Abidjan', type: 'régional',      date: '2025-07-28', location: 'Abidjan, Côte d\'Ivoire', status: 'terminé', delegate: 'F. Diallo' },
];

export const DEMO_DASHBOARD_KPIS = {
  programs:    { total: 12, on_track: 8, attention: 4, risque: 0 },
  diligences:  { urgentes: 0, hautes: 3 },
  audiences:   { pending: 3, ce_mois: 6 },
  partenariats: { actifs: 6, total: 8 },
};

export const DEMO_ALERTS = {
  critical_diligences: [
    { id: 2, title: 'Rapport bilan déploiement fibre optique', deadline: '2025-10-15', responsible: 'F. Diallo' },
    { id: 5, title: 'Suivi accord partenariat Huawei',         deadline: '2025-09-01', responsible: 'O. Fall' },
  ],
  pending_audience_followups: [
    { id: 1, institution: 'Google Africa',         date: '2025-07-10', follow_up: 'Rédaction MOU en cours' },
    { id: 5, institution: 'Startup Sénégal',       date: '2025-06-28', follow_up: 'En attente de rapport' },
  ],
};
