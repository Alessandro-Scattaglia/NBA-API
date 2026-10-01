# Architettura locale

## Obiettivo

L’applicazione è un monorepo locale composto da due workspace:

- backend: Express + TypeScript + Zod
- frontend: React + Vite + TanStack Query + React Router

I due processi vengono avviati contemporaneamente dal root con `npm run dev` usando `concurrently`.

## Backend

- `src/app.ts`: crea l’app Express, registra rotte e middleware per errori.
- `src/server.ts`: bootstrap del server, log iniziali e warmup cache.
- `src/routes/api.ts`: endpoint HTTP e validazione query.
- `src/modules/*`: servizi applicativi per home, teams, players, standings, calendar, leaders, playoffs.
- `src/nba-client/`: client HTTP per le fonti NBA pubbliche.
- `src/cache/memoryCache.ts`: cache in memoria con TTL e stale-while-revalidate.
- `src/config/season.ts`: rilevamento stagione e fase corrente.

## Frontend

- `src/app/App.tsx`: routing principale con React Router.
- `src/lib/api.ts`: wrapper per le chiamate relative a `/api` e stagione selezionata.
- `src/components/layout/AppShell`: layout, navigazione e selettore stagione.
- `src/pages/*`: pagine dell’applicazione.
- `src/styles/*`: tema e layout globale.

## Flusso dati

1. il frontend invoca `/api/...` tramite proxy Vite;
2. Express valida input e query;
3. i servizi consultano cache e client NBA;
4. i payload esterni vengono validati e mappeati in DTO coerenti;
5. il frontend usa TanStack Query per caching, refresh e visualizzazione.

## Local-only

- nessuna autenticazione;
- nessuna API key richiesta;
- nessun deploy pubblico;
- tutte le chiamate sono locali all’ambiente di sviluppo.
