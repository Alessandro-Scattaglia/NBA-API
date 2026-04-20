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

Obiettivo: caricamento rapido e dati aggiornati in continuo anche in produzione.

### 1) Backend su Render

Configurazione servizio consigliata:

- Runtime: Node 22
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm run start`

Variabili ambiente consigliate:

- `NBA_SEASON=2025-26`
- `NBA_REQUEST_TIMEOUT_MS=2200`
- `NBA_REQUEST_RETRIES=0`

Note performance:

- La cache backend usa strategia stale-while-revalidate: se la cache e scaduta, l'API risponde subito con l'ultimo snapshot disponibile e aggiorna in background.
- Al boot del server parte un warmup automatico e un refresh periodico (senza variabili extra) per mantenere i dataset caldi.
- TTL ridotti per standings/calendario per avere feed piu freschi senza bloccare la risposta.

### 2) Frontend su GitHub Pages

Nel repository, imposta il secret `VITE_API_BASE_URL` senza slash finale:

- ✅ `https://nba-api-bb0t.onrender.com`
- ❌ `https://nba-api-bb0t.onrender.com/`

La pipeline workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) usa gia:

- build frontend con `VITE_API_BASE_URL`
- deploy automatico a ogni push su `main`

### 3) Verifica post-deploy (rapida)

1. Apri `/api/health` del backend Render e verifica `ok: true`.
2. Apri la webapp GitHub Pages e controlla che la pagina Home si carichi subito.
3. Verifica che i dati si aggiornino automaticamente senza refresh manuale (refetch periodico frontend + warmup backend).

### 4) Per evitare attese da cold start

Se usi un piano Render che mette in sleep l'istanza, la primissima richiesta dopo inattivita puo essere lenta a prescindere dal codice. Per azzerare questo effetto:

- usa un piano con istanza sempre attiva, oppure
- usa un monitor esterno che richiami periodicamente `/api/health`.
