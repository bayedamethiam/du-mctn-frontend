# DU-MCTN Frontend React

## Stack
React 18 · Vite 5 · Lucide React · CSS-in-JS (inline styles)

## Installation locale
```bash
npm install
cp .env.example .env.local
# .env.local: VITE_API_URL=http://localhost:3000/api
npm run dev   # http://localhost:5173
```

## Build production
```bash
echo "VITE_API_URL=https://votre-api.railway.app/api" > .env.production
npm run build
# Déployer dist/ sur Vercel ou Netlify
```

## Déploiement Vercel
```bash
npx vercel --prod
# Ajouter VITE_API_URL dans Vercel → Settings → Environment Variables
```
