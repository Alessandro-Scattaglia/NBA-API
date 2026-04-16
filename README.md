# NBA 2025-2026 Dashboard

Monorepo con:

- `backend/`: API proxy in Node + TypeScript verso endpoint NBA pubblici senza token
- `frontend/`: web app React + TypeScript + CSS con sidebar e pagine dedicate alla stagione NBA 2025-2026

## Stack

- Frontend: React, Vite, TypeScript, React Router, TanStack Query, CSS
- Backend: Express, TypeScript, Zod, fetch nativo Node 22
- Test: Vitest, Supertest, Testing Library

## Avvio rapido

```bash
npm install
npm run dev
```

App previste:

- frontend su `http://localhost:5173`
- backend su `http://localhost:4001`

## Pagine principali

- Home
- Teams
- Players
- Classifica
- Calendario
- Leaders

## Nota dati

Il backend usa solo fonti gratuite e pubbliche NBA. Le chiamate verso `stats.nba.com` passano dal server per evitare problemi di CORS e per gestire cache, retry e mapping dei payload.

## Deploy (GitHub Pages + Render)

- Backend Render: esporre le API su `https://<tuo-backend>.onrender.com/api/*`
- Frontend GitHub Pages: impostare il secret `VITE_API_BASE_URL` senza slash finale
  - ✅ `https://nba-api-bb0t.onrender.com`
  - ❌ `https://nba-api-bb0t.onrender.com/`
