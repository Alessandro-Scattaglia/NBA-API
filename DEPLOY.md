# Procedura prima del deploy

Questa guida indica cosa eseguire prima di fare push su `main`.

## Regola principale

- Il **frontend** viene pubblicato automaticamente da GitHub Pages dopo un push su
  `main`.
- Il **backend** non viene pubblicato automaticamente: va eseguito Wrangler
  manualmente.
- Non esiste un comando `npm run deploy` per il frontend.

## Modifiche solo frontend

Dalla root del repository:

```bash
npm run typecheck --workspace frontend
npm run test --workspace frontend
npm run build --workspace frontend
npm run preview --workspace frontend
```

Con il preview aperto, verificare:

- home;
- `/NBA-API/standings`;
- `/NBA-API/players`;
- `/NBA-API/insights`;
- una pagina di dettaglio giocatore o squadra;
- layout su larghezza desktop, tablet e telefono;
- refresh diretto delle pagine interne.

Se tutto funziona, fermare il preview, controllare il diff e pubblicare:

```bash
git diff --check
git status
git add <file-modificati>
git commit -m "Descrizione della modifica"
git push origin main
```

Non usare `git add .` alla cieca: controllare prima `git status` e non includere
file temporanei di `.wrangler/`, `dist/`, log o segreti.

Il workflow `.github/workflows/deploy.yml` eseguirà build e deploy su GitHub
Pages. Attendere che la GitHub Action termini con successo prima di verificare
il sito pubblico.

## Modifiche solo backend

Eseguire:

```bash
npm run typecheck --workspace backend
npm run test --workspace backend
npm run build --workspace backend
```

Per verificare localmente anche le API (Wrangler usa la porta `4001`, già
configurata nel comando `dev` del backend):

```bash
npm run dev --workspace backend
```

In un secondo terminale controllare almeno:

```bash
curl http://127.0.0.1:4001/api/health
curl http://127.0.0.1:4001/api/standings
curl http://127.0.0.1:4001/api/players
curl http://127.0.0.1:4001/api/insights
```

Se i controlli sono corretti, pubblicare il Worker:

```bash
npm run deploy --workspace backend
```

Questo comando è il deploy del backend: non aggiorna GitHub Pages e non richiede
un nuovo deploy frontend se il frontend già usa lo stesso URL del Worker tramite
`VITE_API_BASE_URL`.

Usare l'URL realmente stampato da Wrangler per verificare le API pubbliche:

```bash
curl https://<worker-pubblico>/api/health
curl https://<worker-pubblico>/api/standings
curl https://<worker-pubblico>/api/players
curl https://<worker-pubblico>/api/insights
```

Poi fare commit e push:

```bash
git diff --check
git status
git add <file-modificati>
git commit -m "Descrizione della modifica"
git push origin main
```

## Modifiche a frontend e backend insieme

Usare questo ordine:

1. Installare le dipendenze solo se è cambiato `package.json` o
   `package-lock.json`:

   ```bash
   npm install
   ```

2. Eseguire tutti i controlli:

   ```bash
   npm run typecheck
   npm run test
   npm run build
   ```

3. Avviare il test locale completo:

   ```bash
   npm run dev
   ```

   Verificare che il frontend a `http://127.0.0.1:5173` carichi i dati dal
   backend locale e provare almeno classifica, lista giocatori e dettaglio
   giocatore.

4. Pubblicare prima il backend:

   ```bash
   npm run deploy --workspace backend
   ```

5. Verificare l'URL pubblico del Worker con `/api/health`, `/api/standings`,
   `/api/players` e `/api/insights`.

6. Controllare che il secret GitHub Actions `VITE_API_BASE_URL` contenga
   esattamente l'URL pubblico del Worker, incluso `https://`.

7. Fare commit e push su `main`:

   ```bash
   git diff --check
   git status
   git add <file-modificati>
   git commit -m "Descrizione della modifica"
   git push origin main
   ```

8. Attendere il completamento della GitHub Action. Poi verificare il sito
   pubblico su home, classifica, giocatori, dettaglio giocatore e refresh diretto
   delle rotte interne.

## Quale comando aggiorna cosa

| Modifica | Comando necessario |
| --- | --- |
| Solo frontend | `git push origin main`; GitHub Actions pubblica GitHub Pages |
| Solo backend | `npm run deploy --workspace backend` |
| Frontend e backend | prima `npm run deploy --workspace backend`, poi `git push origin main` |

`npm run build`, `npm run test` e `npm run typecheck` verificano il codice ma non
pubblicano nulla. `npm run dev` avvia solo l'ambiente locale.

## Checklist rapida

Prima del push:

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] verifica locale delle pagine interessate
- [ ] `git diff --check`
- [ ] nessun file temporaneo o segreto nel diff

Se cambia il backend:

- [ ] `npm run deploy --workspace backend`
- [ ] verifica delle API pubbliche
- [ ] secret `VITE_API_BASE_URL` corretto

Dopo il push:

- [ ] GitHub Action Pages completata con successo
- [ ] sito pubblico aperto
- [ ] refresh diretto di `/NBA-API/standings`
- [ ] refresh diretto di `/NBA-API/players`
- [ ] verifica della pagina Analisi e dell'endpoint `/api/insights`
- [ ] verifica di una pagina dettaglio
