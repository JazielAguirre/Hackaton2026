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

## Autenticación
La web inicia sesión con Supabase Auth y manda su `access_token` en cada petición:
`Authorization: Bearer <access_token>`. Sin token o con uno inválido la API responde 401.

- Lecturas y escrituras propias del usuario (lotes, fotos, Storage) usan un cliente con su JWT, así RLS decide qué puede ver.
- `frutos`, `analisis_lote` y `sugerencias` solo los escribe la API con la service role.

## Rutas
| Ruta | Qué hace |
| --- | --- |
| `GET /health` | Estado de la API (sin sesión). |
| `GET /yo` | Usuario del token; sirve para comprobar la sesión. |
| `POST /lotes` | Crea un lote del usuario (`nombre` obligatorio). Si no manda `zona_id`, usa la de su perfil. Fruta fuera de mango, jitomate o fresa → 422. |
| `POST /lotes/{id}/fotos` | Sube hasta 20 fotos (multipart, campo `fotos`, 10 MB cada una). Las guarda como JPEG enderezado, sin EXIF y con lado mayor de 1600 px. Si una falla, no se guarda ninguna. |

## Variables de entorno
| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Cliente con el JWT del usuario (aplica RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrituras de la API. **Solo existe en `api/`**, nunca en `web/` ni en git. |
| `CORS_ORIGINS` | Orígenes del front separados por coma. Por defecto `http://localhost:5173`. |
