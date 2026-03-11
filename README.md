# NBA-API

Backend consigliato: Python (FastAPI) per prestazioni e stabilita.

## Avvio backend (Python)
Da root del progetto:
1. Installa dipendenze:
   ```bash
   python3 -m pip install -r backend/requirements.txt
   ```
2. Avvia il server:
   ```bash
   python3 backend/app.py
   ```

Oppure, se sei gia' dentro `backend`:
1. Installa dipendenze:
   ```bash
   python3 -m pip install -r requirements.txt
   ```
2. Avvia il server:
   ```bash
   python3 app.py
   ```

Il backend espone API su `http://localhost:5000/api`.

## Note
- Il backend usa cache per ridurre latenza e errori temporanei dell'upstream NBA.
- Logging abilitato per richieste, cache hit e tempi di risposta.
