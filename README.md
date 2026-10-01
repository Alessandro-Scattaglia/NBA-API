# NBA Dashboard

Monorepo locale per una web app NBA moderna composta da backend Express e frontend React/Vite. L’obiettivo del progetto è offrire dati NBA in locale, senza autenticazione, senza servizi cloud e con una sola procedura di avvio.

## Requisiti

- Node.js 22+
- npm 10+
- accesso locale alla rete del PC per le chiamate a endpoint NBA pubblici

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
- Backend: http://127.0.0.1:4001

Lo script root usa `concurrently` con chiusura automatica dei worker se uno dei due processi fallisce.

## Struttura del progetto

- `backend/`: API Express, cache, client NBA, servizi e validazione
- `frontend/`: app React, pagine, componenti, query TanStack, stile locale
- `docs/`: documentazione architetturale e fonti dati

## Rilevamento automatico della stagione

La stagione non è fissa nel codice. Il backend determina la stagione in modo centralizzato in `backend/src/config/season.ts`:

1. usa `NBA_SEASON` come override locale se impostata;
2. altrimenti infiere la stagione dal calendario NBA corrente;
3. valida sempre il formato `YYYY-YY` come `2026-27`;
4. estrae la fase della stagione (`preseason`, `regular-season`, `play-in`, `playoffs`, `offseason`).

Questo mantiene il comportamento locale, senza necessità di aggiornare costanti manualmente ogni anno.

## Selezione stagioni storiche

Il frontend mostra un selettore di stagione con valore persistito in `localStorage` e pulsante per tornare alla stagione corrente. Tutte le richieste aggiungono automaticamente il parametro `season` all’API locale, e l’API valida il formato.

## Fonti dati

Il backend usa endpoint pubblici NBA già esistenti e li gestisce attraverso il client dedicato. Le chiamate sono centralizzate in `backend/src/nba-client/` e validano payload esterni con Zod, con fallback locale in caso di errore o payload vuoto.

## Cache locale

La cache in memoria è gestita da `backend/src/cache/memoryCache.ts`:

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

## Test e build

Il progetto include test con Vitest per backend e frontend. Il comando root esegue entrambe le suite e controlla le fondamenta di stagione, cache e selezione stagione.

## Risoluzione problemi

- Backend non raggiungibile: verificare che l’app sia stata avviata con `npm run dev`.
- Frontend non raggiungibile: controllare la porta 5173 e la presenza del proxy `/api` in Vite.
- Dati vuoti: il backend usa fallback locale e non trasforma dati mancanti in zero.
- TLS: per problemi locali con certificati, usare `NBA_ALLOW_INSECURE_TLS=1` solo come workaround temporaneo.

## Pulizia cache locale

La cache è in memoria e viene svuotata con il restart del backend. Se si vuole azzerare stato locale, riavviare il processo con:

```bash
npm run dev
```

## Limiti noti

- il backend usa dati pubblici NBA senza autenticazione e senza garantire SLA;
- alcune sezioni storiche o in tempo reale possono essere incomplete se la fonte non restituisce i campi richiesti;
- il frontend mostra correttamente i dati realmente disponibili, senza inventare statistiche mancanti.
