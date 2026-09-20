# DU-MCTN - Frontend

Interface web de la Delivery Unit du MCTN : portefeuille de programmes, diligences, partenariats, audiences, suivi-évaluation, équipe, calendrier et administration.
Application React 18 construite avec Vite 5, sans routeur ni bibliothèque d'interface externe (styles en ligne, icônes lucide-react).
Toutes les données proviennent de l'API du dépôt `du-mctn-backend`.

## Prérequis

| Outil | Version |
|---|---|
| Node.js | 20 ou plus (version utilisée par le workflow de déploiement) |
| npm | fourni avec Node |
| API backend | `du-mctn-backend` en cours d'exécution |

## Installation

```bash
npm install
```

## Lancement en développement avec une API locale

1. Démarrer l'API du dépôt `du-mctn-backend`.
2. Indiquer son adresse dans un fichier `.env.local` (non versionné) :

```
VITE_API_URL=http://localhost:3000/api
```

3. Lancer le serveur de développement :

```bash
npm run dev      # http://localhost:5173
```

Sans `VITE_API_URL`, l'application appelle `/api` en relatif. Le serveur Vite redirige alors `/api` vers `http://localhost:3000` (proxy défini dans `vite.config.js`).

Le dépôt contient déjà `.env.development` (port 3001) et `.env.production`. Un `.env.local` a priorité sur ces fichiers.

## Build

```bash
npm run build    # ou : npx vite build
```

Le résultat est écrit dans `dist/`. `VITE_API_URL` est figée au moment du build : elle doit être définie avant de construire.

## Structure résumée

| Chemin | Contenu |
|---|---|
| `src/main.jsx` | point d'entrée, montage des contextes |
| `src/App.jsx` | sélection de l'écran courant (état `view`) |
| `src/api.js` | couche HTTP, jetons, clients par domaine |
| `src/permissions.js` | droits côté interface (`hasPerm`) |
| `src/theme.js` | jetons de couleur et valeurs de repli |
| `src/context/` | `AuthContext` (session, 2FA), `RefContext` (référentiels, paramètres, rôles) |
| `src/components/` | composants partagés (`UI.jsx`, `Layout`, `HeroBanner`, `AccountModal`…) |
| `src/pages/` | un fichier par écran |
| `src/utils/` | formatage des dates et politique de mot de passe |
| `tests/` | tests Playwright (configuration dans `playwright.config.js`) |

## Documentation

- Documentation technique du frontend : [`docs/FRONTEND.md`](docs/FRONTEND.md)
- Contrats d'API, droits, référentiels et déploiement du serveur : documentation du dépôt `du-mctn-backend`
