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

## Configurazione locale

Il progetto e configurato per funzionare solo in locale:

- frontend su `http://localhost:5173`
- backend su `http://localhost:4001`
- richieste frontend sempre relative a `/api`, inoltrate da Vite al backend locale

Variabili ambiente backend utili in locale:

- `NBA_SEASON=2025-26`
- `NBA_REQUEST_TIMEOUT_MS=6000`
- `NBA_REQUEST_RETRIES=1`
- `NBA_ALLOW_INSECURE_TLS=1` solo se il PC usa antivirus/proxy con ispezione TLS e il backend fallisce con errori certificato

Note:

- la cache backend usa strategia stale-while-revalidate per rispondere piu velocemente ai refresh
- al boot del server parte un warmup automatico e un refresh periodico dei dataset principali
- per verificare il backend, apri `http://localhost:4001/api/health`
