# API locale

## Endpoint principali

### `/api/health`

Ritorna lo stato del backend, la stagione attiva, il phase della stagione e statistiche base della cache.

### `/api/seasons`

Ritorna la lista delle stagioni supportate e la stagione attuale.

### `/api/seasons/current`

Ritorna la stagione corrente e la fase rilevata.

### `/api/home`

Homepage con partite del giorno, prossime partite, leader e spotlight in base alla fase.

### `/api/teams`

Elenco squadre della stagione attiva o del parametro `season` validato.

### `/api/teams/:teamId`

Dettaglio squadra con roster, recent games e statistiche.

### `/api/players`

Catalogo giocatori con ricerca, filtro e paginazione.

### `/api/players/:playerId`

Dettaglio giocatore con recent games e statistiche di stagione.

### `/api/standings`

Classifica East/West con posizione, seed, play-in e note di playoff.

### `/api/playoffs`

Bracket NBA, serie, finali e date chiave della postseason.

### `/api/calendar`

Calendario per data e filtro per team/status.

### `/api/leaders`

Leaders per categorie statistiche.

## Parametri opzionali

Molti endpoint accettano un parametro `season` in query, con validazione su formato `YYYY-YY`.

Esempio:

```http
GET /api/standings?season=2025-26
```

## Meta risposta

Tutte le principali risposte includono un oggetto `meta` coerente con:

- `season`
- `seasonPhase`
- `source`
- `fetchedAt`
- `stale`
