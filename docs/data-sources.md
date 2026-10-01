# Fonti dati NBA

## Panoramica

Il backend usa le API pubbliche NBA per ottenere i dati utili all’app. L’accesso è gestito solo lato server per mantenere il backend locale e evitare problemi di CORS.

## Dati principali

### Squadre e standings

- fonte: `stats.nba.com` (delegato via client server-side)
- uso: elenco squadre, dettagli, classifica, conference, playoff picture
- comportamento: in caso di payload vuoto o endpoint temporaneamente indisponibile, il backend usa fallback locale coerente

### Giocatori

- fonte: `stats.nba.com`
- uso: catalogo giocatori, roster, dettagli, statistiche e recent games
- campo chiave: `PLAYER_ID`, `PLAYER_NAME`, `TEAM_ID`

### Calendario e partite

- fonte: `cdn.nba.com/static/json/...` e `stats.nba.com`
- uso: schedule, scoreboard, box score, status delle partite
- regole: solo i dati realmente disponibili vengono mostrati; valori mancanti restano `null`/vuoti, non zerati

### Leader e statistiche

- fonte: statistica NBA dinamica via endpoint `leagueleaders` / `leagueDash*`
- uso: punti, rimbalzi, assist, stoppate, triple, percentuali
- note: per le categorie non disponibili in una stagione, il backend restituisce `null` o omette il campo secondo il contratto

## Fase della stagione

La determinazione della fase è centralizzata in `backend/src/config/season.ts` e usa un fallback temporale rigoroso dopo il tentativo di stabilire la stagione dalla data e dal calendario NBA.

## Limiti noti

- alcune sezioni storiche possono avere dati incompleti;
- alcuni endpoint potrebbero tornare vuoti in offseason o durante lo switch di stagione;
- i dati live devono essere trattati come non affidabili fino a quando non sono validati.
