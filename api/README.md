# API de FruitScan

FastAPI que corre el análisis de fruta por lote. Preclasificación visual, no certificación de exportación.

## Arranque
Requiere Python 3.12 (las librerías de ML aún no tienen ruedas para 3.14).

```bash
cd api
cp .env.example .env          # llena SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

- Documentación interactiva: http://localhost:8000/docs
- Estado: `GET /health`
- Pruebas: `pytest`

## Variables de entorno
| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Cliente con el JWT del usuario (aplica RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrituras de la API. **Solo existe en `api/`**, nunca en `web/` ni en git. |
| `CORS_ORIGINS` | Orígenes del front separados por coma. Por defecto `http://localhost:5173`. |
