# NBA Dashboard

Monorepo locale per una web app NBA moderna composta da backend Hono su Cloudflare Workers e frontend React/Vite. Il backend espone un proxy CORS verso gli endpoint pubblici NBA.

## Requisiti

- Node.js 22+
- npm 10+
- accesso locale alla rete del PC per le chiamate a endpoint ESPN e NBA pubblici

## Installazione

```bash
npm install
```

## Avvio completo

```bash
npm run dev
```

L’avvio avvia in parallelo:

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:4001 (Wrangler)

Lo script root usa `concurrently` con chiusura automatica dei worker se uno dei due processi fallisce.

## Struttura del progetto

- `backend/`: API Hono/Workers, cache, client NBA, servizi e validazione
- `frontend/`: app React, pagine, componenti, query TanStack, stile locale
- `docs/`: documentazione architetturale e fonti dati

## Rilevamento automatico della stagione

La stagione non è fissa nel codice. Il backend determina la stagione in modo centralizzato in `backend/src/config/season.ts`:

1. usa `NBA_SEASON` come override locale se impostata;
2. altrimenti infiere la stagione dal calendario NBA corrente;
3. valida sempre il formato `YYYY-YY` come `2026-27`;
4. estrae la fase della stagione (`preseason`, `regular-season`, `play-in`, `playoffs`, `offseason`).

Questo mantiene il comportamento locale, senza necessità di aggiornare costanti manualmente ogni anno.

## Stagione

Il frontend usa esclusivamente la stagione determinata dal backend; non è disponibile una selezione manuale di stagioni storiche.

## Fonti dati

Il backend usa endpoint pubblici NBA già esistenti e li gestisce attraverso il client dedicato. Le chiamate sono centralizzate in `backend/src/nba-client/`: ESPN fornisce calendario e fallback dei dettagli, NBA CDN scoreboard/boxscore e NBA Stats statistiche/classifiche. Le risposte vuote o non valide non sostituiscono snapshot validi.

## Cache locale

La cache L1 in memoria è gestita da `backend/src/cache/memoryCache.ts`; in Cloudflare Workers la cache L2 condivisa usa il binding KV `NBA_CACHE`:

- chiavi per dataset e stagione;
- TTL differenziati;
- refresh in background;
- dato stale mantenuto fino al refresh;
- deduplicazione delle richieste concorrenti;
- statistiche di health check via `/api/health`.

## Gestione errori

Il backend:

- valida input, query param e payload esterni;
- espone errori leggibili senza stack trace nel JSON;
- usa fallback locale per dataset temporaneamente non disponibili;
- segnala metadati `stale` quando serve l’ultimo dato valido disponibile.

## Comandi disponibili

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run test --workspace backend
npm run test --workspace frontend
```

## Deploy del backend

Il backend usa Wrangler e legge la configurazione dai binding definiti in
`backend/wrangler.toml`. Per lo sviluppo locale:

```bash
npm run dev --workspace backend
```

Per pubblicare il Worker:

```bash
npm run deploy --workspace backend
```

Creare prima i namespace KV e sostituire gli ID placeholder in
`backend/wrangler.toml`:

```bash
npx wrangler kv namespace create NBA_CACHE
npx wrangler kv namespace create NBA_CACHE --preview
npx wrangler deploy --config backend/wrangler.toml
```

Non sono richieste API key per ESPN o per le fonti NBA pubbliche. Per il deploy del
frontend, configura però il secret GitHub Actions `VITE_API_BASE_URL` con l’URL
pubblico completo del Worker, incluso `https://` (per esempio
`https://<worker>.<account>.workers.dev`). Il valore deve essere l’URL realmente
stampato da `wrangler deploy`, non un hostname inventato o un percorso GitHub Pages.
I Cron Trigger configurati aggiornano scoreboard/live ogni 2 minuti, calendario
ogni 6 ore e dataset stagionali ogni giorno; il Worker esegue ogni refresh in modo
indipendente.

## Test e build

Il progetto include test con Vitest per backend e frontend. Il comando root esegue entrambe le suite e controlla le fondamenta di stagione e cache.

Per la procedura completa prima del push e del deploy consultare
[DEPLOY.md](./DEPLOY.md).

Prima di pubblicare il frontend, eseguire la stessa build usata da GitHub Pages:

```bash
npm install
npm run build --workspace frontend
npm run preview --workspace frontend
```

Con il preview aperto, verificare anche un refresh diretto su `/NBA-API/standings`,
`/NBA-API/players` e su una pagina dettaglio. Il workflow pubblica una copia di
`index.html` come `404.html`, necessaria perché GitHub Pages possa avviare React
anche quando si apre direttamente una rotta interna.

## Risoluzione problemi

- Backend non raggiungibile: verificare che l’app sia stata avviata con `npm run dev`.
- Frontend non raggiungibile: controllare la porta 5173 e la presenza del proxy `/api` in Vite.
- Dati vuoti: il backend usa fallback locale e non trasforma dati mancanti in zero.
- TLS: per problemi locali con certificati, usare `NBA_ALLOW_INSECURE_TLS=1` solo come workaround temporaneo.

## Pulizia cache locale

La cache locale è in memoria e viene svuotata con il restart del backend. In produzione
KV è condivisa tra le istanze; per azzerarla usare la dashboard Cloudflare o Wrangler.

```bash
npm run dev
```

## Limiti noti

- il backend usa dati pubblici NBA senza autenticazione e senza garantire SLA;
- le emittenti mostrate nel calendario sono solo quelle comunicate dalla fonte NBA;
  se il payload non le contiene viene mostrato esplicitamente che il dato non è disponibile;
- alcune sezioni storiche o in tempo reale possono essere incomplete se la fonte non restituisce i campi richiesti;
- il frontend mostra correttamente i dati realmente disponibili, senza inventare statistiche mancanti.
