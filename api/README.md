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

- Requiere el servicio de inferencia para analizar lotes: `docker compose up -d --build inferencia` desde la raíz (ver `inferencia/README.md`).
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
| `POST /lotes` | Crea un lote del usuario (`nombre` obligatorio). `parcela_id` opcional (parcela activa del mismo usuario; si no manda `parcela`, se usa su nombre). Si no manda `zona_id`, usa la de la parcela o, si no, la de su perfil. Fruta fuera de mango, jitomate o fresa → 422. |
| `POST /lotes/{id}/fotos` | Sube hasta 20 fotos (multipart, campo `fotos`, 10 MB cada una). Las guarda como JPEG enderezado, sin EXIF y con lado mayor de 1600 px. Si una falla, no se guarda ninguna. |
| `POST /lotes/{id}/analizar` | Responde 202 con el lote en `analizando` y sigue en segundo plano: descarga cada foto válida, la manda al servicio de inferencia, guarda los `frutos` (el destino lo asigna el trigger) y llama `cerrar_analisis_lote()`. 409 si ya está `analizando` (reciente) o `analizado` (no hay re-análisis por ahora), 422 sin fotos válidas. Si algo falla, el lote queda en `error` sin frutos de esa corrida y se puede reintentar. También se reintenta un lote en `analizando` con más de `ANALISIS_VENCIDO_MINUTOS` sin cambios (la API se cayó a la mitad): antes de correr de nuevo se borran los frutos que hubiera dejado la corrida cortada. La web consulta `GET /lotes/{id}` hasta `analizado` o `error`. Si el lote tiene fruta, la manda a `/inferir` (campo `fruta`) y todos sus frutos se clasifican con el clasificador de esa fruta; si no la tiene, usa la del detector y el lote toma la que más detectó. |
| `GET /bitacora` | Lotes del usuario (vista `bitacora_lotes`, con RLS) del más nuevo al más antiguo: `{total, limite, desplazamiento, lotes}`. Filtros `fruta`, `grado`, `zona_id`; paginación `limite` (1–100, por defecto 20) y `desplazamiento`. Cada lote trae `frutos_por_destino` (null si aún no tiene frutos). |
| `GET /lotes/{id}/reporte.pdf` | PDF con ReportLab: datos del lote, grado, tabla por clase y destino, sugerencias y el aviso de que es una preclasificación visual. 409 si el lote no está analizado. |
| `POST /zonas` | Registra una zona. Solo si `perfiles.rol` es `acopio` o `tecnico` (403 si no). Nombre único sin importar acentos ni mayúsculas (409), coordenadas válidas y juntas (422). |
| `GET /lotes/{id}` | Lote con nombre de zona, fotos (URL firmada que vence en 1 hora), análisis más reciente, frutos con su clase y sugerencias. Sin análisis: `analisis` es `null` y las listas van vacías. Lote ajeno → 404. |

## Variables de entorno
| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Cliente con el JWT del usuario (aplica RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrituras de la API. **Solo existe en `api/`**, nunca en `web/` ni en git. |
| `INFERENCIA_URL` | Servicio de inferencia (`inferencia/`). Por defecto `http://127.0.0.1:8001`. |
| `ANALISIS_VENCIDO_MINUTOS` | Minutos en `analizando` tras los cuales un lote se considera caído y se puede reintentar. Por defecto `10`. |
| `CORS_ORIGINS` | Orígenes del front separados por coma. Por defecto `http://localhost:5173,http://127.0.0.1:5173`. |
