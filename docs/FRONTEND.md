# Documentation technique du frontend DU-MCTN

Portée : le code présent dans `src/` sur la branche `master`. Les contrats d'API cités ont été vérifiés dans le dépôt `du-mctn-backend`. Les points incertains sont signalés par « À vérifier ».

## 1. Vue d'ensemble

| Élément | Choix retenu |
|---|---|
| Bibliothèque | React 18.3 (`react`, `react-dom`) |
| Outil de build | Vite 5 avec `@vitejs/plugin-react` |
| Bibliothèque d'interface | aucune. Pas de Tailwind, pas de Material UI, pas de styled-components |
| Styles | objets `style` en ligne, jetons centralisés dans `src/theme.js` |
| Icônes | `lucide-react` |
| Routeur | aucun. La navigation repose sur l'état `view` de `App.jsx` |
| État | `useState` local plus deux contextes React (`AuthContext`, `RefContext`) |
| Polices | EB Garamond et DM Sans, chargées par `index.html` depuis Google Fonts |

Les seules dépendances de production sont `react`, `react-dom` et `lucide-react`.

Conséquences du choix « pas de routeur » :

- l'URL ne change jamais pendant la navigation : ni lien profond, ni bouton retour ;
- le seul paramètre d'URL lu est `reset_token`, consommé par `Login.jsx` puis retiré de la barre d'adresse ;
- `public/.htaccess` réécrit toute requête non fichier vers `index.html`, ce qui suffit pour une application à écran unique.

Graphisme : thème sombre unique (`T.bg` = `#060f22`), pas de mode clair.

## 2. Arborescence de `src`

```
src/
├── main.jsx                  Point d'entrée : monte AuthProvider > RefProvider > App
├── App.jsx                   Table VIEWS, état `view`, rechargement périodique des alertes
├── api.js                    Couche HTTP unique : jetons, refresh, erreurs, clients par domaine
├── permissions.js            Droits côté interface : hasPerm, ADMIN_PERMS, repli hérité
├── theme.js                  Jetons de couleur T, statusConf, SETTINGS_FALLBACK
│
├── context/
│   ├── AuthContext.jsx       Session : login, 2FA, completeLogin, logout, refreshUser
│   └── RefContext.jsx        Référentiels, paramètres, rôles ; helpers list/label/color/has…
│
├── components/
│   ├── UI.jsx                Composants partagés (Card, Badge, Btn, Modal…)
│   ├── Layout.jsx            En-tête, barre de navigation, menu compte
│   ├── HeroBanner.jsx        Bandeau de tête d'écran (titre, statistiques, action)
│   ├── LogoDU.jsx            Logo paramétrable (sigle et sous-titre issus des paramètres)
│   ├── AccountModal.jsx      Mon compte : profil, mot de passe, 2FA, sessions
│   └── PasswordChecklist.jsx Règles de mot de passe + hook usePasswordPolicy
│
├── pages/
│   ├── Login.jsx             Connexion, 2FA, mot de passe oublié, réinitialisation
│   ├── Dashboard.jsx         KPI, alertes, programmes, événements à venir
│   ├── Portefeuille.jsx      Axes, programmes, projets, phases, templates, rendez-vous
│   ├── Diligences.jsx        Instructions ministérielles et leur suivi
│   ├── Partenariats.jsx      Partenaires et documents ; onglet imbriqué Instances
│   ├── Instances.jsx         Représentation internationale, scores, contributions
│   ├── Audiences.jsx         Audiences reçues et actions post-audience
│   ├── SuiviEval.jsx         Indicateurs, revues, évaluations
│   ├── Equipe.jsx            Organigramme, fiches membres, création d'accès
│   ├── Calendrier.jsx        Agenda consolidé de toutes les échéances
│   └── Administration.jsx    Utilisateurs, rôles, référentiels, paramètres, journal
│
└── utils/
    ├── authFormat.js         parseServerDate, fmtDateTime, isFuture, shortUserAgent
    └── passwordPolicy.js     DEFAULT_POLICY, passwordRules, checkPassword
```

Fichiers hors `src/` à connaître :

| Fichier | Rôle |
|---|---|
| `index.html` | fond, polices, animations CSS globales (`spin`, `slide-in`, `fade-in`), barre de défilement |
| `vite.config.js` | port 5173 et proxy `/api` vers `http://localhost:3000` |
| `public/.htaccess` | réécriture vers `index.html` sur l'hébergement |
| `tests/` | tests Playwright (`playwright.config.js`) |
| `new_version.tsx` | maquette historique à la racine, importée nulle part |

## 3. Couche API (`src/api.js`)

### 3.1 Base d'URL

```js
const BASE = import.meta.env.VITE_API_URL || '/api';
```

La variable est figée au moment du build. Sans variable, les appels partent en relatif sur `/api`, ce que le proxy Vite redirige en développement. Côté serveur, toutes les routes métier sont montées sous `/api`.

### 3.2 Jetons

| Jeton | Stockage | Durée côté serveur |
|---|---|---|
| `accessToken` | variable de module `_token` + `localStorage['du_token']` | 30 minutes par défaut |
| `refreshToken` | `localStorage['du_refresh']` | 7 jours par défaut |
| `mfaToken` | état React de `Login.jsx`, jamais persisté | 5 minutes |

`setToken(t)` met à jour la variable et le `localStorage` (et supprime la clé si `t` est vide). `getToken()` lit la variable en mémoire, ce qui évite un accès au stockage à chaque requête. Le refresh token a la forme `<idSession>.<secret>` ; le stocker dans `localStorage` est un choix assumé, qui le fait survivre à la fermeture de l'onglet au prix d'une exposition à un script tiers injecté dans la page.

### 3.3 Rafraîchissement automatique avec rotation

`tryRefresh()` appelle `POST /auth/refresh` avec le refresh token stocké.

- Un seul appel concurrent : la promesse est mémorisée dans `_refreshing` et partagée par tous les appels simultanés, puis libérée au tour de boucle suivant.
- Rotation : le serveur régénère un secret à chaque appel et renvoie un nouveau refresh token, qui remplace l'ancien dans `localStorage` ; le précédent devient inutilisable. L'identifiant de session ne change pas et la date d'expiration n'est pas prolongée : au bout de sept jours, la reconnexion est obligatoire même en usage continu. La réponse ne contient pas d'objet `user`, c'est `GET /auth/me` qui porte le profil et les droits.
- En cas d'échec (réseau, réponse non `ok`, absence d'`accessToken`), la fonction renvoie `false` sans lever d'exception.

### 3.4 Routes publiques

```js
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/mfa/verify',
                      '/auth/forgot-password', '/auth/reset-password', '/auth/options'];
```

Sur ces chemins, un 401 signifie « refusé » (identifiants incorrects, code 2FA invalide, session expirée) et non « session à rafraîchir ». Aucun refresh n'est tenté et l'utilisateur n'est pas déconnecté : le message du serveur remonte tel quel à l'écran.

### 3.5 Gestion des 401 et des 403

`authFetch` :

1. envoie la requête ;
2. si le statut est 401 et que le chemin n'est pas public, tente un refresh puis rejoue la requête ;
3. si le second essai renvoie encore 401, efface les deux jetons, appelle le callback enregistré par `setUnauthCallback` (qui vide `user` dans `AuthContext`) et lève `Session expirée. Veuillez vous reconnecter.`

`request` traite ensuite le corps. Le serveur n'émet que trois codes d'erreur nommés, tous en 403 :

| Code serveur | Traitement dans `api.js` |
|---|---|
| `FORBIDDEN` | message uniforme `Votre rôle ne permet pas cette action.`, quel que soit l'écran. La réponse porte aussi `required: [...]`, la liste des droits attendus, conservée dans `err.data` |
| `PASSWORD_CHANGE_REQUIRED` | message serveur conservé, code recopié dans `err.code` |
| `MFA_SETUP_REQUIRED` | idem |

Les deux derniers traduisent un blocage de configuration, pas un refus de droits : tant que le mot de passe provisoire n'est pas changé ou que la 2FA obligatoire n'est pas activée, le serveur n'autorise que `/api/auth/*`, `/api/settings` et `/api/ref` (racines exactes). Tout le reste répond 403.

Conséquence concrète : dans cet état, `RefContext` charge bien les référentiels et les paramètres, mais `GET /roles` est refusé. L'appel est protégé par un `.catch(() => [])`, donc `ref.roles` reste vide et `RoleChip` retombe sur le référentiel `user_role`. C'est voulu : l'utilisateur ne voit de toute façon que la fenêtre de configuration forcée.

### 3.6 Forme des erreurs enrichies

Toute erreur levée par `request` est un `Error` enrichi :

| Propriété | Contenu |
|---|---|
| `message` | `data.error` du serveur, ou `Erreur <status>`, ou le message uniforme des 403 `FORBIDDEN` |
| `status` | code HTTP |
| `data` | corps JSON complet (`{}` si le corps n'est pas du JSON) |
| `code` | présent uniquement pour `MFA_SETUP_REQUIRED` et `PASSWORD_CHANGE_REQUIRED` |

Le serveur répond systématiquement `{ error: "message en français" }`, ce qui permet d'afficher `err.message` sans reformulation. Exemple d'exploitation de `data` dans `Login.jsx` : un 423 (compte verrouillé) lit `err.data.locked_until` pour afficher l'heure de déverrouillage.

### 3.7 Téléchargement de fichiers

Les pièces jointes ne sont pas servies en statique par le serveur. `downloadFile(path, name)` passe par `authFetch`, crée un `Blob`, fabrique un `<a download>` temporaire, le déclenche puis révoque l'URL au bout d'une seconde. Deux usages : `partnershipsApi.downloadDoc` et `seApi.downloadRevueDoc`.

### 3.8 Clients exposés

`api` fournit `get`, `post`, `put`, `patch`, `delete` et `upload` (qui construit un `FormData` avec le champ `file` plus les champs additionnels). Au-dessus, un objet par domaine métier :

| Objet | Préfixe |
|---|---|
| `authApi` | `/auth` (connexion, 2FA, sessions, mot de passe) |
| `dashboardApi` | `/dashboard/kpis`, `/dashboard/alerts` |
| `axesApi` | `/axes` |
| `programsApi` | `/programs` et ses projets |
| `diligencesApi` | `/diligences` |
| `partnershipsApi` | `/partnerships` et ses documents |
| `audiencesApi` | `/audiences` |
| `seApi` | `/se` (indicateurs, jalons, revues, évaluations) |
| `instancesApi` | `/instances` et ses contributions |
| `projectMeetingsApi` | `/project-meetings` |
| `intlEventsApi` | `/intl-events` |
| `workflowTemplatesApi` | `/workflow-templates` |
| `refApi` | `/ref` |
| `rolesApi` | `/roles`, `/roles/permissions` |
| `settingsApi` | `/settings`, `/settings/public` |
| `usersApi` | `/auth/users`, `/auth/login-events` |
| `teamApi` | `/team` |

Règle du projet : aucune page n'appelle `fetch` directement. La seule exception est `Equipe.jsx`, qui utilise `api.get('/team?include_inactive=1')` parce que `teamApi.list()` ne prend pas de paramètre (commentaire explicite dans le code).

## 4. Contextes

### 4.1 `AuthContext`

Valeur exposée : `{ user, loading, login, completeLogin, verifyMfa, logout, refreshUser }`.

| Fonction | Comportement |
|---|---|
| `login(email, password)` | appelle `POST /auth/login`. Si la réponse porte `mfa_required`, renvoie `{ mfa_required: true, mfaToken }` sans connecter l'utilisateur. Sinon enchaîne sur `completeLogin`. |
| `verifyMfa(mfaToken, code)` | appelle `POST /auth/mfa/verify` puis `completeLogin`. Le même champ accepte un code TOTP à 6 chiffres ou un code de secours au format `XXXX-XXXX`, consommé à l'usage. |
| `completeLogin(data)` | enregistre l'access token, stocke le refresh token s'il est présent, puis charge le profil complet par `GET /auth/me`. En cas d'échec de `/auth/me`, retombe sur le `data.user` partiel renvoyé par la connexion. |
| `logout()` | appelle `POST /auth/logout` avec le refresh token (erreurs ignorées), efface les jetons, vide `user`. |
| `refreshUser()` | recharge `GET /auth/me`. Appelé après un changement de profil, l'activation ou la désactivation de la 2FA. |

Au montage, un effet enregistre le callback d'invalidation (`setUnauthCallback`) puis tente de restaurer la session : `GET /auth/me`, et si cela échoue, un refresh suivi d'un second `/auth/me`. `loading` reste à `true` pendant cette séquence, ce qui évite d'afficher l'écran de connexion à un utilisateur déjà authentifié.

Pourquoi passer systématiquement par `/auth/me` : c'est le seul endpoint qui renvoie le profil complet. Champs utilisés par l'interface :

```
id, name, email, role, department, phone, is_active,
must_change_password, mfa_enabled, last_login_at, locked_until,
failed_logins, created_at,
mfa_setup_required,    // calculé : 2FA absente et rôle soumis à mfa_required_roles
session_method,        // 'password' | 'mfa' | 'mfa:recovery'
permissions            // tableau de clés de droits, ou ['*'] pour l'administrateur
```

Les booléens arrivent en entiers 0 ou 1, d'où les `!!Number(user.mfa_enabled)` du code.

### 4.2 `RefContext`

Ce contexte centralise tout ce qui est paramétrable : listes de référence (`/ref`), paramètres de l'organisation (`/settings`) et rôles (`/roles`).

Chargement (`reload`) :

- utilisateur connecté : `refApi.list()`, `settingsApi.all()` et `rolesApi.list()` en parallèle. L'appel aux rôles est protégé par `.catch(() => [])`, pour rester compatible avec une API antérieure sans `/roles` et pour survivre à l'état « configuration requise » ;
- utilisateur non connecté : seulement `settingsApi.public()`, qui ne renvoie que 11 clés d'identité (`org_short_name`, `org_name`, `org_subtitle`, `ministry_short`, `ministry_name`, `country`, `plan_name`, `plan_short`, `plan_start`, `plan_end`, `email_domain`). C'est exactement ce dont l'écran de connexion a besoin ;
- toute erreur est absorbée : l'application continue avec les valeurs de repli.

Fonctions exposées :

| Fonction | Rôle |
|---|---|
| `list(domain, { includeInactive })` | valeurs d'un référentiel, actives seulement par défaut |
| `item(domain, code)` | l'entrée complète (comparaison en chaînes) |
| `label(domain, code)` | libellé, à défaut le code brut, à défaut une chaîne vide |
| `color(domain, code, fallback)` | couleur de la valeur, sinon `fallback` (défaut `#94a3b8`) |
| `codes(domain, flag)` | codes portant un marqueur logique dans leur `meta` |
| `has(domain, code, flag)` | vrai si ce code porte ce marqueur |
| `setting(key)` | paramètre, sinon `SETTINGS_FALLBACK`, sinon chaîne vide |
| `json(key, fallback)` | paramètre analysé en JSON ; renvoie `fallback` si le JSON est invalide, nul, ou d'un type différent (tableau contre objet) |
| `scoreColor(score)` | couleur d'un score selon les seuils du paramètre `score_thresholds` |
| `planPeriod` | chaîne `<plan_start>-<plan_end>` |
| `roles`, `role(code)`, `roleLabel(code)`, `roleColor(code)` | rôles de la table `roles` ; le libellé vient du rôle, la couleur du référentiel `user_role` |
| `items`, `settings`, `ready`, `reload` | données brutes, état de chargement, rechargement |

Une valeur de référentiel a la forme suivante côté API :

```
{ id, domain, code, label, color, position, is_system, is_active, meta, created_at, updated_at }
```

Le champ d'ordre s'appelle `position`. `meta` est déjà désérialisé en objet par le serveur. `is_system` et `is_active` sont des entiers.

`/settings` renvoie un objet plat dont **toutes les valeurs sont des chaînes**, y compris les valeurs structurées. D'où l'existence de `ref.json(key, fallback)` : `score_thresholds`, `instance_pillars`, `se_cycle`, `currencies`, `mfa_required_roles`, `project_closed_statuses`, `stats_excluded_programs` et `instance_urgency_days` doivent toujours passer par lui, jamais par `ref.setting`.

Marqueurs `meta` employés dans le code : `closed`, `done`, `held`, `open`, `nominal`, `alert`, `critical`, `high`, `active`. Ce sont les neuf marqueurs que le serveur protège sur les valeurs système. Deux clés supplémentaires ne sont pas protégées et peuvent disparaître si quelqu'un réécrit les métadonnées : `strong` (utilisé par `Instances.jsx` sur `instance_level`) et `desc` (texte d'aide affiché par `SuiviEval.jsx` sur `indicator_status`). Le marqueur `done` n'est lu que par le frontend ; le serveur ne s'en sert nulle part.

Valeurs de repli, par ordre de priorité :

1. `FLAG_FALLBACK` (`RefContext.jsx`) : marqueurs par défaut pour onze domaines, tant qu'aucun élément du domaine n'est chargé ;
2. `SETTINGS_FALLBACK` (`theme.js`) : valeurs par défaut des paramètres d'organisation ;
3. `statusConf` (`theme.js`) : libellés et couleurs de statut, utilisés par `Badge` sans domaine ou sur un code inconnu.

Subtilité de `codes` : le repli `FLAG_FALLBACK` ne s'applique que si le domaine est totalement absent. Dès que le référentiel est chargé, un domaine sans marqueur renvoie un tableau vide, et les bascules de statut qui en dépendent deviennent inertes. Un référentiel mal renseigné se traduit donc par des boutons sans effet plutôt que par une erreur.

## 5. Droits côté interface

### 5.1 `hasPerm`

```js
hasPerm(user, ...keys)   // vrai si l'utilisateur possède AU MOINS UN des droits demandés
```

- Si `user.permissions` est un tableau : `'*'` donne tous les droits, sinon simple appartenance.
- Sinon (API qui ne renverrait pas `permissions`), repli sur `LEGACY_MIN_ROLE`, table associant chaque clé au rôle historique minimal, évaluée par `can(user, role)` via `ROLE_LEVEL` (`admin` 8, `director` 7, `coordinator` 6, `analyst` 5). Une clé absente est considérée réservée à l'administrateur.

Cette table reflète les quatre rôles livrés par défaut côté serveur : `admin` (tous les droits), `director` (37 droits sur 39, tout sauf `users.manage` et `roles.manage`), `coordinator` (21) et `analyst` (9). Ces rôles sont insérés une fois en base puis modifiables : la table `LEGACY_MIN_ROLE` est donc une photographie de l'état initial, pas une référence vivante.

`ROLE_LEVEL`, `can` et `isAdmin` restent exportés pour compatibilité. Seul `can` est encore appelé, uniquement par le repli de `hasPerm`.

### 5.2 `ADMIN_PERMS`

```js
export const ADMIN_PERMS = ['users.read', 'users.manage', 'roles.manage',
                            'ref.manage', 'settings.manage', 'audit.read'];
```

Ces droits ouvrent l'écran Administration. Ils servent à deux endroits :

- `Layout.jsx` affiche l'onglet Administration si l'utilisateur possède l'un d'eux ;
- `App.jsx` renvoie le tableau de bord si `view === 'admin'` sans aucun de ces droits, ce qui empêche d'atteindre l'écran par un état résiduel.

Dans `Administration.jsx`, chaque onglet porte en plus sa propre liste de droits (`TABS`), et seuls les onglets autorisés sont rendus.

### 5.3 La règle : l'interface masque, le serveur refuse

Les contrôles `hasPerm` ne sont que du confort d'affichage. Ils cachent un bouton ou un onglet ; ils ne protègent rien. L'autorisation réelle est faite par le serveur, qui relit les droits depuis la table `roles` et renvoie un 403 `FORBIDDEN`, transformé par `api.js` en message unique `Votre rôle ne permet pas cette action.`

Deux conséquences pour qui écrit du code ici :

1. ne jamais ajouter un appel d'API en se fiant au seul masquage de l'interface : le droit correspondant doit exister et être appliqué côté serveur ;
2. ne jamais réimplémenter la logique d'autorisation dans une page. Un nouveau contrôle prend la forme `hasPerm(user, 'clé.du.catalogue')`, avec la clé exacte renvoyée par `GET /roles/permissions`.

Le catalogue serveur compte 39 droits, répartis en huit familles (Portefeuille 11, Diligences 2, Audiences 2, Partenariats 4, Suivi-Évaluation 6, Instances 6, Équipe 2, Administration 6). L'interface les utilise tous. La liste à jour s'obtient par `GET /roles/permissions`, qui renvoie `{ key, group, label }` pour chacun ; c'est elle qui alimente l'écran Rôles et droits. Les clés employées par chaque écran figurent dans les tableaux de la section 7.

## 6. Composants partagés (`components/UI.jsx`)

| Composant | Signature utile | Remarques |
|---|---|---|
| `Card` | `{ children, style, hover, onClick }` | conteneur de base ; `hover` ajoute une élévation au survol |
| `Badge` | `{ status, domain, size }` | avec `domain`, libellé et couleur viennent du référentiel ; sans `domain`, repli sur `statusConf` puis sur le code brut |
| `RoleChip` | `{ code, title, size }` | libellé par `roleLabel`, couleur par `roleColor` (référentiel `user_role`) |
| `Btn` | `{ onClick, color, variant, size, disabled }` | `variant` : `solid` (dégradé), `outline`, `ghost` (fond teinté) |
| `Input` | `{ value, onChange, icon, type, disabled }` | `onChange` reçoit la valeur, pas l'événement |
| `Select` | `{ value, onChange, children }` | apparence native supprimée, chevron en SVG ; injecte une fois la feuille `#du-select-style` pour le fond des `<option>` |
| `Textarea` | `{ value, onChange, rows }` | redimensionnement vertical seulement |
| `Modal` | `{ open, onClose, title, width }` | voile sombre flouté, fermeture au clic hors du panneau |
| `ModalFooter` | `{ onCancel, onConfirm, confirmLabel, loading, color }` | boutons à droite, spinner pendant l'enregistrement |
| `Spinner` | `{ size, color }` | s'appuie sur l'animation `spin` de `index.html` |
| `ErrorBanner` | `{ error, onDismiss }` | ne rend rien si `error` est vide |
| `EmptyState` | `{ icon, title, subtitle }` | état vide illustré |
| `ProgressBar` | `{ value, color, height }` | valeur bornée à 100 |

### Conventions de style

- Toutes les couleurs viennent de `T` (`theme.js`). Aucun hexadécimal direct dans une page, sauf les couleurs de type d'événement, constantes locales assumées (`EVT_TYPES` dans `Dashboard.jsx`, `TYPES` dans `Calendrier.jsx`) et les palettes de sélection `COLORS` et `AX_COLORS`.
- L'opacité s'obtient en suffixant un hexadécimal : `` `${color}26` `` pour environ 15 %, `` `${color}18` ``, `` `${color}44` ``. Cela suppose des couleurs de référentiel au format hexadécimal.
- Fonds opaques : `T.panel` (`#0d1f3c`) pour les fenêtres d'édition, `T.field` (`#13294a`) pour les champs. L'opacité est délibérée, pour que la page ne transparaisse pas derrière un formulaire ouvert au-dessus du voile sombre.
- Deux familles typographiques, indiquées explicitement sur chaque élément : `EB Garamond` pour les titres, `DM Sans` pour le reste. Les animations `fade-in` et `slide-in` sont des classes CSS de `index.html`, appliquées via `className`.

## 7. Les écrans

### 7.1 `Login.jsx`

Quatre étapes dans un même composant, pilotées par l'état `step` : `password`, `mfa`, `forgot`, `reset`.

- Données : `GET /auth/options` par `loadAuthOptions()` (mémorisé au niveau du module, un seul appel par chargement de page) ; libellés d'organisation via `/settings/public`.
- Actions : connexion, vérification 2FA, demande de lien de réinitialisation, définition d'un nouveau mot de passe.
- Points d'attention :
  - `/auth/options` renvoie `{ password_reset, email_enabled, password_policy }`. Les deux booléens valent la même chose côté serveur : « l'envoi d'emails est configuré ». Ils sont pourtant lus séparément (`password_reset` par `Login.jsx`, `email_enabled` par `usePasswordPolicy`) ;
  - `password_policy.min_length` suit le paramètre `password_min_length`, mais `min_classes` est figé à 3 côté serveur : le rendre paramétrable demanderait une modification du backend ;
  - `reset_token` est lu une seule fois à l'initialisation puis retiré de l'URL par `history.replaceState` ;
  - un 401 « expiré » pendant l'étape 2FA ramène à l'étape mot de passe (le `mfaToken` ne vit que cinq minutes) ;
  - un 423 affiche l'heure de fin de verrouillage, lue dans `err.data.locked_until` ;
  - la conformité du mot de passe est vérifiée côté client avant envoi, mais la règle serveur reste l'autorité.

### 7.2 `Dashboard.jsx`

- Rôle : vue de pilotage consolidée.
- Données : `dashboard/kpis`, `dashboard/alerts`, `programs`, plus six listes servant uniquement à composer les événements à venir (rendez-vous projet, diligences, audiences, instances, événements, partenariats), chacune protégée par `.catch(() => [])`.
- Actions : aucune. Écran en lecture seule, donc aucun contrôle de droits.
- Points d'attention :
  - les compteurs « nominaux » et « en alerte » se calculent à partir des marqueurs `nominal` et `alert` du référentiel `program_status`, jamais d'une liste de codes en dur ;
  - les diligences clôturées sont exclues via `has('diligence_status', …, 'closed')` ;
  - le seuil de mise en évidence d'une échéance vient du paramètre `alert_days` ;
  - `App.jsx` recharge en plus les alertes toutes les cinq minutes pour la pastille de la barre de navigation.

### 7.3 `Portefeuille.jsx`

L'écran le plus dense (environ 1 170 lignes, trois composants : `Portefeuille`, `PhaseEditor`, `ProgramCard`).

- Données : `programs`, `team`, `axes`, `workflow-templates` au chargement ; les projets d'un programme sont chargés à la demande, au premier dépliage, et mis en cache dans `projMap`.
- Actions et droits :

| Action | Droit |
|---|---|
| créer, modifier, supprimer un programme | `programs.create`, `programs.update`, `programs.delete` |
| gérer les axes | `axes.manage` |
| créer, modifier, supprimer un projet | `projects.create`, `projects.update`, `projects.delete` |
| enregistrer ou modifier un template de workflow | `templates.manage` |
| supprimer un template | `templates.delete` |
| gérer les rendez-vous projet | `meetings.manage`, `meetings.delete` |

- Modèle des phases : chaque projet porte un tableau `phases` sérialisé en JSON, dont chaque entrée a `key`, `label`, `color`, `weight`, `start_date`, `end_date`, `progress`. L'avancement global est recalculé côté client par `computeGlobal` (somme de `progress × weight / 100`) et envoyé dans le champ `progress`.
- Points d'attention :
  - la somme des poids doit valoir 100 ; l'écart est signalé et l'enregistrement demande confirmation, il n'est pas bloqué ;
  - le paramètre `program_progress_mode` (`manual` ou `projects`) décide si l'avancement d'un programme est saisi ou calculé depuis les projets, pondéré par budget ; dans le second cas le champ est désactivé et la valeur calculée est affichée ;
  - `project_closed_statuses` et `stats_excluded_programs` (paramètres JSON) évitent de coder en dur des codes de statut ou de programme ;
  - appliquer un template réinitialise dates et avancement des phases, avec confirmation en modification.

Anomalie : voir la section 10, ligne 1078.

### 7.4 `Diligences.jsx`

- Données : `diligences`, plus `team` pour les suggestions de responsable.
- Actions : créer et modifier (`diligences.manage`), supprimer (`diligences.delete`), bascule rapide de statut (`diligences.manage`).
- Points d'attention :
  - la bascule rapide s'appuie sur les marqueurs `done` et `closed` et ne passe jamais par un statut d'annulation ; le choix complet reste dans la fenêtre d'édition ;
  - « en retard » se calcule sur `deadline` en excluant les statuts marqués `closed` ;
  - les sources déjà saisies alimentent un `datalist` trié par fréquence ;
  - `withCurrent` ajoute la valeur courante aux options si elle a disparu du référentiel, pour qu'une modification ne la perde pas silencieusement.

### 7.5 `Partenariats.jsx`

- Rôle : partenaires techniques et financiers, avec un second onglet qui rend `Instances` en mode `embedded`.
- Données : `partnerships`, `programs/all-projects`, `instances`, `programs`.
- Actions et droits : `partnerships.manage` (créer, modifier), `partnerships.delete`, `partnerships.docs` (joindre), `partnerships.docs.delete` (retirer).
- Points d'attention :
  - le champ `projects` accepte des identifiants de projet et des codes de programme ; les valeurs non reconnues apparaissent comme « liens historiques conservés » et ne sont jamais supprimées en silence ;
  - deux champs de montant coexistent : `amount_value` (numérique, formaté en français) et `amount` (texte libre de détail) ;
  - la liste des devises vient du paramètre JSON `currencies` ;
  - `FILE_ACCEPT` reproduit la liste d'extensions acceptée par le serveur ; duplication assumée, à tenir à jour si le serveur change. La limite de taille côté serveur est de 50 Mo (erreur 413).

### 7.6 `Instances.jsx`

- Rôle : qualité de la représentation internationale. Rendu autonome ou imbriqué (`embedded` masque le bandeau de tête).
- Données : `instances` (contributions incluses dans la réponse).
- Actions et droits : `instances.manage`, `instances.delete`, `contributions.manage`, `contributions.delete`.
- Points d'attention :
  - les piliers de score viennent du paramètre JSON `instance_pillars`, mais seules les clés `presence`, `contribution`, `postes` et `suivi` sont retenues, car la base ne possède que les colonnes `score_*` correspondantes. Le serveur applique la même contrainte à l'écriture du paramètre ;
  - le score affiché est une conversion sur 100 du total des piliers rapporté à la somme des maxima ;
  - `instance_urgency_days` (deux seuils) colore l'urgence des prochaines réunions ;
  - les catégories inconnues du référentiel mais présentes dans les données apparaissent quand même dans les onglets, avec leur code brut ;
  - `mandats` et `gaps` sont saisis à raison d'un élément par ligne et envoyés sous forme de tableaux.

### 7.7 `Audiences.jsx`

- Données : `audiences`, `team` (sélecteur de responsable d'action).
- Actions et droits : `audiences.manage` (créer, modifier, basculer le statut, gérer les actions), `audiences.delete`.
- Points d'attention :
  - les actions post-audience sont stockées dans le champ `actions_json` de l'audience ; chaque modification renvoie la liste complète par un `PUT` sur l'audience ;
  - une action garde `responsible_id` et `responsible` (le nom) pour rester lisible si le membre est désactivé ; si la sélection n'a pas changé, le responsable d'origine est conservé tel quel ;
  - la bascule de statut d'une action parcourt l'ordre du référentiel `action_status` ;
  - les filtres sont générés depuis les référentiels, avec le préfixe `s:` pour un statut et `p:` pour une priorité.

### 7.8 `SuiviEval.jsx`

Quatre sous-onglets : vue d'ensemble, indicateurs, revues et COPIL, évaluations indépendantes.

- Données : `se/indicators`, `se/revues`, `se/evaluations`, `se/stats`, `programs`.
- Actions et droits :

| Action | Droit |
|---|---|
| modifier un indicateur | `indicators.update` |
| créer ou supprimer un indicateur | `indicators.manage` |
| créer, modifier, supprimer une revue | `revues.manage` |
| joindre un document de revue | `revues.docs` |
| retirer un document de revue | `revues.docs.delete` |
| gérer les évaluations | `evaluations.manage` |

- Points d'attention :
  - la progression d'un indicateur tient compte de `direction` (`asc` ou `desc`), y compris pour l'interprétation de la tendance ;
  - les jalons passent par un appel distinct (`PUT /se/indicators/:id/milestones`) après l'enregistrement de l'indicateur. Si cet appel échoue juste après une création, la fenêtre bascule en mode édition pour éviter un doublon au second essai ;
  - le graphique radar des évaluations s'appuie sur le référentiel `eval_criteria` et ne s'affiche qu'à partir de trois critères ;
  - les catégories d'indicateurs désactivées restent visibles si des indicateurs les utilisent encore, mais ne sont plus proposées à la création ;
  - le cycle de pilotage vient du paramètre JSON `se_cycle`, la phrase d'ambition du paramètre `plan_ambition`.

### 7.9 `Equipe.jsx`

- Rôle : organigramme, avec trois vues (hiérarchie, pôles, grille).
- Données : `team`, `programs` (pour reconnaître les codes programme dans les expertises), et `auth/users` si l'utilisateur a le droit de la lire.
- Actions et droits : `team.manage` (créer, modifier, réactiver, afficher les inactifs), `team.delete` (désactiver), `users.read` ou `users.manage` (voir les comptes), `users.manage` (créer un accès applicatif).
- Points d'attention :
  - une fiche liée à un compte prend son identité du compte : nom, email et téléphone sont désactivés dans le formulaire et ne sont pas renvoyés, le serveur les réécrit ;
  - la désactivation propose de couper en même temps l'accès applicatif lorsqu'un compte actif est lié ;
  - la création d'un accès envoie une invitation si `email_enabled` est vrai, sinon demande un mot de passe provisoire conforme à la politique ;
  - `users === null` signifie « liste des comptes indisponible » : le champ de rattachement est masqué et `user_id` retiré de la charge utile, pour ne pas l'écraser ;
  - le niveau proposé par défaut est l'avant-dernier du référentiel `team_level`, dont les codes sont numériques.

### 7.10 `Calendrier.jsx`

- Rôle : agenda consolidé, en vue mois ou liste.
- Données : six sources fusionnées (rendez-vous projet, diligences, audiences, instances, partenariats, événements internationaux), chacune protégée par `.catch(() => [])`.
- Actions et droits : seuls les événements internationaux, nationaux et régionaux sont modifiables ici, via `events.manage` et `events.delete`. Les autres entrées sont en lecture seule et se modifient depuis leur écran d'origine.
- Points d'attention :
  - la semaine commence le lundi ; mois et jours sont produits par `Intl.DateTimeFormat('fr-FR')` ;
  - la clé du jour est calculée en date locale et non via `toISOString`, pour éviter un décalage de fuseau ;
  - les diligences clôturées sont filtrées au rendu et non au chargement, car les marqueurs de référentiel peuvent arriver après les données ;
  - cet écran utilise sa propre fenêtre modale au lieu du composant `Modal`, avec un `zIndex` de 1000.

### 7.11 `Administration.jsx`

Cinq onglets, chacun conditionné par ses droits (`TABS`).

| Onglet | Droits | Contenu |
|---|---|---|
| Utilisateurs | `users.read`, `users.manage` | comptes, invitations, réinitialisation de mot de passe, déverrouillage, réinitialisation 2FA, révocation des sessions, suppression définitive, création de la fiche équipe |
| Rôles et droits | `roles.manage` | création et modification de rôles, cases à cocher par famille de droits |
| Référentiels | `ref.manage` | listes paramétrables, par domaine, avec ordre, couleur et métadonnées JSON |
| Paramètres | `settings.manage` | paramètres de l'organisation, en quatre sections |
| Journal de connexion | `audit.read` | 200 derniers événements, filtrables par utilisateur et par résultat |

Points d'attention :

- les 26 domaines de référentiels sont déclarés dans la constante `DOMAINS` (libellés lisibles et regroupement) ; un domaine inconnu remonté par l'API est regroupé dans une section « Autres » sous son code brut, donc rien n'est perdu ;
- `FIXED_DOMAINS = ['user_role']` : ce référentiel n'accepte pas d'ajout côté interface, comme côté serveur, car ses codes sont liés aux droits d'accès. Seuls libellé et couleur sont modifiables ;
- un rôle système reçoit tous les droits et ses droits ne sont pas modifiables ; seuls libellé et description sont envoyés, faute de quoi le serveur répond 400 ;
- le code d'un rôle et le code d'une valeur de référentiel ne sont pas modifiables après création, puisqu'ils sont enregistrés dans les données. Un rôle encore utilisé par un compte ne peut pas être supprimé ;
- l'onglet Paramètres n'envoie pas un paramètre absent en base et laissé vide, pour ne pas écraser la valeur par défaut du serveur. Le serveur, de son côté, ne met à jour que les clés qui existent déjà : un `PUT` ne crée jamais de nouveau paramètre ;
- les champs marqués `json` sont réaffichés indentés et validés avant envoi. Le serveur valide en plus le contenu et répond 400 avec le nom du champ ;
- après une modification de rôle ou de référentiel, `ref.reload()` rafraîchit l'ensemble de l'application.

Anomalie : voir la section 10, onglet Utilisateurs.

### 7.12 `AccountModal.jsx`

Trois onglets : profil, sécurité, sessions. Deux modes forcés, non fermables, déclenchés depuis `App.jsx` :

- `forced="password"` quand `user.must_change_password` est vrai ;
- `forced="mfa"` quand `user.mfa_setup_required` est vrai, c'est-à-dire quand le rôle figure dans `mfa_required_roles` sans 2FA activée.

Dans les deux cas, la seule issue en dehors de la configuration est le lien de déconnexion. À la fin de la procédure, `onClose` recharge la page.

Points d'attention :

- l'activation de la 2FA est protégée par un garde `started.current` pour ne pas générer deux secrets lors du double montage de `React.StrictMode` ;
- les codes de secours ne sont affichés qu'une fois, avec un bouton de copie et un accusé de lecture ;
- la 2FA n'est pas désactivable si le rôle figure dans `mfa_required_roles` ;
- la session courante est repérée par le champ `current` renvoyé par `GET /auth/sessions` et ne peut pas être révoquée depuis cette liste.

## 8. Conventions de code du projet

1. **Styles en ligne uniquement.** Pas de fichier CSS applicatif, pas de classes utilitaires. Les seules règles globales sont dans `index.html` (remise à zéro, animations, barre de défilement) et la feuille injectée une fois par `Select`.
2. **Toutes les couleurs passent par `theme.js`.** Un nouveau besoin ajoute un jeton dans `T`, il ne fige pas un hexadécimal dans une page.
3. **L'interface est en français.** Libellés, messages d'erreur et commentaires. Les identifiants du code (variables, chemins d'API, codes de référentiel) restent dans la langue de l'API.
4. **Pas de tirets longs.** Ni `—` ni `–`, ni dans le code, ni dans les libellés, ni dans la documentation. Un tiret simple suffit.
5. **Aucune valeur métier codée en dur.** Libellés, couleurs, statuts et seuils viennent des référentiels (`ref.list`, `ref.label`, `ref.color`, `ref.has`) et des paramètres (`ref.setting`, `ref.json`). Le code ne suppose jamais qu'un statut s'appelle `fait` ou `tenue` : il demande les codes qui portent le marqueur `done` ou `held`.
6. **Les valeurs de repli sont documentées à leur point de définition** (`FLAG_FALLBACK`, `SETTINGS_FALLBACK`, `statusConf`, `PILLARS_FALLBACK`, `FALLBACK_PHASES`, `DEFAULT_POLICY`). Elles servent à survivre à une API indisponible, pas à remplacer la configuration.
7. **Les commentaires expliquent le pourquoi.** Le projet commente les décisions non évidentes (rotation du refresh token, garde de `StrictMode`, conservation des liens historiques) et laisse le code lisible parler pour le reste. Pas de commentaire qui paraphrase la ligne suivante.
8. **Une valeur disparue du référentiel n'est jamais perdue.** Le motif `withCurrent` (sous ce nom ou sous une forme équivalente dans `Diligences`, `Audiences`, `Instances`, `Calendrier`, `SuiviEval`, `Partenariats`) ajoute la valeur courante aux options quand elle n'y figure plus.
9. **Mise à jour optimiste avec repli** : `if (updated) setItems(...) else load();`.
10. **Les appels secondaires sont tolérants.** Une liste annexe se charge avec `.catch(() => [])` pour qu'un domaine indisponible ne bloque pas l'écran.

## 9. Recettes

### 9.1 Ajouter un écran

1. Créer `src/pages/MonEcran.jsx`, avec un `HeroBanner` en tête et un conteneur `<div style={{ padding: 28 }}>`.
2. Dans `App.jsx` : importer le composant et ajouter une entrée à `VIEWS`, par exemple `monecran: MonEcran`.
3. Dans `Layout.jsx` : ajouter une entrée au tableau `NAV` avec `id` (la même clé), `icon` (une icône `lucide-react`) et `label`. Si l'écran doit être réservé, conditionner l'entrée par `hasPerm(user, 'clé')`, comme pour Administration.
4. Si l'écran est réservé, prévoir aussi un repli dans `App.jsx` sur le modèle de la ligne `view === 'admin'`, sans quoi il resterait atteignable par un état résiduel.
5. Charger les données avec un `useCallback` `load` plus un `useEffect`, et gérer `loading` et `error` avec `Spinner` et `ErrorBanner`.

### 9.2 Ajouter un champ à un formulaire

1. Ajouter la clé dans la constante `EMPTY` du fichier (chaîne vide pour du texte, `[]` pour une liste).
2. Ajouter la lecture dans `openEdit`, avec un repli : `champ: item.champ || ''`.
3. Ajouter le contrôle dans la fenêtre, en réutilisant `Input`, `Select` ou `Textarea`, et en suivant la grille existante (`display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12`).
4. Si le champ est obligatoire, ajouter le contrôle en tête de la fonction d'enregistrement, avec un message en français.
5. Si le champ est numérique, convertir explicitement avant l'envoi. Le projet distingue la chaîne vide de zéro : `champ === '' ? null : Number(champ)`.
6. Vérifier que le serveur accepte ce champ : l'interface ne filtre pas la charge utile, et le serveur ignore ou rejette ce qu'il ne connaît pas.

### 9.3 Ajouter une liste de référence

1. Côté serveur, créer le domaine dans `REF_DEFAULTS` (`migrations.js`) avec ses valeurs et leurs éventuels marqueurs `meta`.
2. Dans `Administration.jsx`, ajouter `['mon_domaine', 'Libellé lisible']` au bon groupe de `DOMAINS`. Sans cela, le domaine apparaît quand même, mais dans le groupe « Autres » et sous son code brut.
3. Dans la page concernée, lire la liste avec `ref.list('mon_domaine')` et afficher les valeurs avec `<Badge status={x} domain="mon_domaine" />` ou `ref.label('mon_domaine', code)`.
4. Si une logique dépend d'une valeur particulière, ne pas comparer au code : poser un marqueur `meta` et interroger `ref.has('mon_domaine', code, 'mon_marqueur')`. Un marqueur hors des neuf reconnus par le serveur n'est pas protégé sur les valeurs système : il peut être effacé lors d'une modification des métadonnées.
5. Si ce marqueur est indispensable au fonctionnement, ajouter une entrée dans `FLAG_FALLBACK` (`RefContext.jsx`) pour que l'écran reste utilisable avant le chargement des référentiels.
6. Le sélecteur du formulaire doit appliquer le motif `withCurrent`, pour conserver une valeur devenue inactive.

### 9.4 Ajouter un droit et l'utiliser

1. Côté serveur : déclarer la clé dans `lib/permissions.js` et l'appliquer sur la route par `authorize('ma.cle')`. C'est le serveur qui fait autorité.
2. L'ajouter aux rôles par défaut de `DEFAULT_ROLES` ne suffit pas sur une base existante : ces rôles sont insérés une seule fois. Les rôles déjà en base doivent être mis à jour depuis Administration > Rôles et droits.
3. Le nouveau droit devient automatiquement cochable dans cet écran, puisqu'il affiche le catalogue renvoyé par `GET /roles/permissions`.
4. Côté frontend, dans la page concernée : `const canFaire = hasPerm(user, 'ma.cle');` puis `{canFaire && <Btn …>}`.
5. Si ce droit doit ouvrir un onglet d'Administration, l'ajouter à la liste `perms` de l'onglet dans `TABS` et, si l'onglet est nouveau, à `ADMIN_PERMS` dans `permissions.js`.
6. Optionnel : ajouter la clé à `LEGACY_MIN_ROLE` avec le rôle historique minimal. Cette table ne sert que si l'API ne renvoie pas `user.permissions` ; une clé absente y est traitée comme réservée à l'administrateur.
7. Ne jamais ajouter de contrôle côté client sans droit serveur correspondant : le masquage ne protège rien.

## 10. Incohérences relevées

Aucun fichier de `src/` n'a été modifié lors de la rédaction de ce document.

| Fichier | Ligne | Constat |
|---|---|---|
| `src/pages/Portefeuille.jsx` | 1078 | `ProgramCard` appelle `ref.label('project_status', proj.status)` alors que `ref` n'est pas dans sa portée : il appartient au composant `Portefeuille`, qui se termine ligne 840, et n'est pas passé en props. `ReferenceError` lorsqu'un projet porte un statut de clôture sans phase correspondante. Correction : passer `ref` en props, ou appeler `useRefData()` dans `ProgramCard`. |
| `src/pages/Administration.jsx` | 201, 252 à 263 | L'onglet Utilisateurs s'ouvre avec `users.read` seul, mais les actions d'écriture (nouveau compte, modification, réinitialisation de mot de passe, suppression, déverrouillage, révocation des sessions) ne sont pas conditionnées à `users.manage`. Elles échoueront en 403. Le rôle `director` livré par défaut a `users.read` sans `users.manage` : le cas est donc réel. |
| `src/permissions.js` | 21 à 37 | `revues.docs.delete` est utilisé par `SuiviEval.jsx` mais absent de `LEGACY_MIN_ROLE`, alors que le rôle `coordinator` le possède côté serveur. Sans effet tant que l'API renvoie `user.permissions`. |
| `src/theme.js` | 43 | `scoreColor` est exporté et marqué obsolète ; plus aucun appel ne l'utilise. Code mort. |
| `src/permissions.js` | 12 | `isAdmin` est exporté mais n'est appelé nulle part dans `src/`. Code mort. |
| `.env.development`, `.env.example`, `vite.config.js` | - | `.env.example` indique le port 3000, `.env.development` le port 3001, le proxy Vite vise le port 3000. Les trois ne concordent pas. En développement, `.env.development` gagne et le proxy n'est jamais utilisé. |
| `.github/workflows/deploy.yml` | - | Le dépôt frontend et le dépôt backend possèdent chacun un workflow qui construit et publie `dist/` au même emplacement. Voir la section 11.3. |
| racine | - | `new_version.tsx` (environ 60 ko) n'est importé nulle part. Fichier de maquette historique. |

## 11. Build et déploiement

### 11.1 Commandes

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances |
| `npm run dev` | serveur de développement sur `http://localhost:5173`, avec proxy `/api` vers `http://localhost:3000` |
| `npm run build` (équivalent `npx vite build`) | produit `dist/` |
| `npm run preview` | sert `dist/` localement |
| `npx playwright test` | tests de bout en bout du dossier `tests/`. Playwright n'est pas listé dans `package.json` et doit être installé séparément |

### 11.2 Variable `VITE_API_URL`

Seule variable d'environnement lue par le code (`api.js`). Elle donne l'adresse complète de l'API, préfixe `/api` inclus.

| Fichier | Valeur présente dans le dépôt |
|---|---|
| `.env.example` | `http://localhost:3000/api` |
| `.env.development` | `http://localhost:3001/api` |
| `.env.production` | `https://du-api.bayedame.com/api` |
| `.env.local` | non versionné, prioritaire sur les précédents |

Elle est figée au moment du build : changer d'API impose de reconstruire. Sans valeur, l'application appelle `/api` en relatif, ce qui suppose que l'API soit servie sur le même domaine. L'origine du frontend doit par ailleurs figurer dans la liste blanche CORS du serveur, qui autorise déjà `localhost:5173` à `5176`, `du.thba7054.odns.fr`, `du-numerique.com` et les sous-domaines `*.vercel.app` et `*.odns.fr`.

### 11.3 Publication

Le site est publié par le workflow GitHub Actions du dépôt **backend**, `du-mctn-backend/.github/workflows/deploy.yml` (« Deploy Backend + Frontend → O2switch »). Il se déclenche sur un `push` vers `master` du dépôt backend ou manuellement, et enchaîne :

1. checkout du backend, puis checkout du dépôt `bayedamethiam/du-mctn-frontend` dans un sous-dossier `frontend/` ;
2. Node 20, `npm ci` et `npm run build` dans `frontend/`, avec `VITE_API_URL` pris dans le secret du même nom (le job échoue si le secret est vide) ;
3. préparation de la clé SSH, puis ouverture temporaire du pare-feu O2switch : purge de la liste blanche SSH, ajout de l'adresse IP du runner, attente de propagation ;
4. déploiement du backend (rsync, `npm install --omit=dev`, migrations, `touch tmp/restart.txt` pour Passenger) ;
5. déploiement du frontend : `rsync --delete-after frontend/dist/` vers `~/public_html/du.thba7054.odns.fr/`, puis copie de `frontend/public/.htaccess` à la racine du site ;
6. retrait de l'adresse IP de la liste blanche, exécuté systématiquement, puis vérification informative de `/health`.

Un push sur le dépôt frontend seul ne déclenche pas ce workflow : il prend l'état courant de `master` du frontend au moment où le backend est publié.

Le dépôt frontend possède en parallèle son propre workflow, `.github/workflows/deploy.yml` (« Deploy Frontend → O2switch »), déclenché sur un `push` vers `master` du frontend. Il enchaîne les mêmes étapes de build et de publication, vers le même répertoire, avec les mêmes secrets. Les deux chemins coexistent donc et écrivent au même endroit. C'est redondant et à arbitrer : soit le workflow frontend est conservé pour publier l'interface seule, soit il est supprimé au profit du workflow unique du backend.

Secrets communs aux deux workflows : `VITE_API_URL`, `SSH_PRIVATE_KEY`, `SSH_PASSPHRASE`, `SSH_HOST`, `SSH_USER`, `CPANEL_PASSWORD_ENCODED`. Environnement GitHub : `prod`.

### 11.4 Hébergement

Site statique sur O2switch, serveur Apache avec cPanel (pas de nginx). `public/.htaccess` désactive `MultiViews` et réécrit toute requête qui ne correspond pas à un fichier existant vers `index.html`. C'est ce qui permet à l'application de fonctionner sans routeur, y compris après un rechargement. L'API tourne derrière Passenger sur le port 3002, exposée par un reverse-proxy `.htaccess` côté backend.

## 12. Pour aller plus loin

- `README.md` à la racine : installation et démarrage rapide.
- Dépôt `du-mctn-backend` : `docs/ARCHITECTURE.md`, `docs/DONNEES.md`, `docs/SECURITE.md`, `docs/EXPLOITATION.md`. Ce sont les références pour le modèle de données, le catalogue des droits, la sécurité et l'exploitation du serveur.
- Documentation vivante de l'API : Swagger UI servi sur `/api-docs` par le backend, généré depuis `swagger.js`.
