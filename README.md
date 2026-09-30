# NBA Dashboard

Monorepo con:

- `backend/`: API proxy in Node + TypeScript verso endpoint NBA pubblici senza token
- `frontend/`: web app React + TypeScript + CSS con sidebar e pagine dedicate alla stagione NBA configurata

## Stack

- Frontend: React, Vite, TypeScript, React Router, TanStack Query, CSS
- Backend: Express, TypeScript, Zod, fetch nativo Node 22
- Type checking: TypeScript

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

- `NBA_SEASON=2025-26` opzionale: se assente, il backend passa alla nuova stagione da settembre, così il calendario di ottobre include anche le partite gia pubblicate. Puoi impostare qualsiasi stagione, ad esempio `2024-25` o `2026-27`.
- `NBA_REQUEST_TIMEOUT_MS=6000`
- `NBA_REQUEST_RETRIES=1`
- `NBA_ALLOW_INSECURE_TLS=1` solo se il PC usa antivirus/proxy con ispezione TLS e il backend fallisce con errori certificato

Note:

- la cache backend usa strategia stale-while-revalidate per rispondere piu velocemente ai refresh
- al boot del server parte un warmup automatico e un refresh periodico dei dataset principali
- per verificare il backend, apri `http://localhost:4001/api/health`

## Cache backend

La cache e in memoria e non contiene dati permanenti: si svuota quando il processo backend viene riavviato. Serve a limitare le chiamate agli endpoint NBA, ridurre i tempi di caricamento e restituire l'ultimo dato valido mentre un aggiornamento viene eseguito in background.

Non e indispensabile per il funzionamento logico dell'applicazione, ma e fortemente consigliata in produzione. Senza cache aumentano timeout, rate limit e risposte vuote quando gli endpoint NBA sono lenti o temporaneamente indisponibili.

## Stagioni

La stagione non e fissata nel frontend. Tutte le risposte API espongono `data.season` e la UI usa quel valore per titoli e tabelloni. Per cambiare stagione in modo esplicito, avvia il backend con `NBA_SEASON=2026-27`.
