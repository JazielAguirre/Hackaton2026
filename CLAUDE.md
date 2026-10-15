# FruitScan

Web para control de calidad de fruta por lote. El productor toma fotos con la cámara del celular desde el navegador o sube fotos de su galería; el sistema detecta cada fruto, lo clasifica, asigna un destino por fruto y un grado al lote, y guarda todo en una bitácora con reporte PDF.

Proyecto del Hackatón LSC 2026, equipo Los Claudios. Reto: que una comunidad responda mejor ante una situación crítica. Comunidad: productores de una zona y su centro de acopio. Situación crítica: perder la cosecha por un lote rechazado o por un brote poscosecha que se propaga.

## Alcance
- Frutas: mango, jitomate y fresa. Cualquier otra fruta se marca como "fruta no soportada" y no se analiza.
- Es una preclasificación visual, NO una certificación de exportación. Ningún texto de la app debe decir lo contrario.
- Orden del MVP: 1) mango de punta a punta; 2) jitomate y fresa; 3) bitácora, PDF y sugerencias; 4) validación de foto, tendencias y alertas por zona.

## Arquitectura
Flujo: foto → detector YOLO (ubica cada fruto y su tipo) → recorte → clasificador de esa fruta → trigger en la BD asigna destino → `cerrar_analisis_lote()` calcula el grado → imagen marcada, reporte y sugerencias.

| Carpeta | Contenido |
| --- | --- |
| `web/` | React + Vite (PWA). Cámara con `<input type="file" accept="image/*" capture="environment" multiple>`. supabase-js con anon key. |
| `api/` | FastAPI. Corre detector y clasificadores, genera imagen marcada y PDF. Usa la service role key. |
| `ml/` | Scripts y notebooks de entrenamiento. `ml/data/` no se sube a git. |
| `supabase/migrations/` | Copia SQL de cada migración aplicada. |

Rutas de la API: `POST /lotes`, `POST /lotes/{id}/fotos`, `POST /lotes/{id}/analizar`, `GET /lotes/{id}`, `GET /lotes/{id}/reporte.pdf`, `GET /bitacora`.

## Comandos (actualizar cuando existan)
- Web: `cd web && npm install && npm run dev`
- API: `cd api && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`

## Base de datos (Supabase, PostgreSQL)
- Tablas: `frutas`, `clases`, `umbrales_grado`, `configuracion`, `fichas`, `lotes`, `fotos`, `frutos`, `analisis_lote`, `sugerencias`. Vista `bitacora_lotes`. Funciones `cerrar_analisis_lote()` y `alertas_comunitarias()`. Bucket privado `fotos-lotes` con ruta `{usuario_id}/{lote_id}/{foto_id}.jpg`.
- El destino de cada fruto lo asigna el trigger de `frutos` con `clases.destino_default` y un umbral de confianza: `clases.umbral_confianza` si la clase tiene uno propio (mango `otro_defecto`: 0.85) y, si no, `configuracion.umbral_confianza`. Bajo el umbral, el fruto va a `revision_manual`. No dupliques esa lógica en Python ni en la web.
- Cambios de esquema SOLO con migraciones del MCP (`apply_migration`), con copia en `supabase/migrations/<timestamp>_<descripcion>.sql`. Muestra el SQL y espera confirmación antes de aplicar. Nunca borres tablas ni datos sin permiso explícito.
- RLS en todas las tablas. Toda tabla o función nueva lleva sus políticas y permisos en la misma migración. En funciones, revoca EXECUTE de `public` y `anon`.
- Nombres en español, snake_case, sin acentos ni ñ.
- Después de cambiar el esquema, regenera `web/src/types/database.ts`.
- Tablas: `frutas`, `clases`, `umbrales_grado`, `configuracion`, `fichas`, `zonas`, `perfiles`, `lotes`, `fotos`, `frutos`, `analisis_lote`, `sugerencias`. Vista `bitacora_lotes`. Funciones `cerrar_analisis_lote()` (solo service role) y `alertas_comunitarias()` (agrupa por `zona_id` y devuelve `zona_nombre`). Bucket privado `fotos-lotes` con ruta `{usuario_id}/{lote_id}/{foto_id}.jpg`. Los lotes usan `zona_id` de la tabla `zonas`, no texto libre.
- Login con Supabase Auth (correo y contraseña). Al registrarse, el trigger `crear_perfil_usuario()` crea el perfil con `nombre_completo`, `organizacion` y `zona_id` tomados de `options.data` en `signUp`. El rol nunca sale de la metadata y solo lo cambia la service role. El perfil se edita con `.update()`, no con `upsert`.
## Dominio (no cambiar sin acuerdo del equipo)
Clases por fruta (código → destino por defecto):
- mango: `sano` → exportacion · `antracnosis` → separar · `pudricion_pedunculo` → separar · `otro_defecto` → mercado_nacional
- jitomate: `sano` → exportacion · `pudricion_mancha` → separar · `dano_fisico` → procesamiento
- fresa: `sana` → exportacion · `moho_gris` → separar · `antracnosis` → separar · `oidio_fruto` → procesamiento

Color de cada destino en la imagen: exportacion verde, mercado_nacional amarillo, procesamiento naranja, separar rojo, revision_manual gris.

Grado del lote (tabla `umbrales_grado`, editable): A con 95 % o más sanos y 0 % para separar; B con 85 % o más y 2 % o menos; C con 70 % o más y 5 % o menos; si no cumple ninguno, rechazo. Los porcentajes se calculan sobre frutos clasificados, sin contar `revision_manual`.

Configuración inicial: `umbral_confianza` 0.60, `min_frutos_muestra` 30, `alerta_dias` 7, `alerta_min_lotes` 3.

## Modelos
- Detector: YOLO nano preentrenado con 3 clases (mango, jitomate, fresa). Métrica: mAP50.
- Clasificadores: uno por fruta, MobileNetV3 o EfficientNet-B0 con transfer learning (congelar base, entrenar cabeza, luego ajustar las últimas capas). Métricas: exactitud, F1 macro y matriz de confusión; Grad-CAM para explicar.
- `frutos.conf_clasificacion` es la probabilidad top-1 de la clase que predice el modelo, antes de agrupar `cancro_bacteriano` y `sarna` en `otro_defecto` (mapeo en `ml/config/mapeo_clases.json`). No uses la suma de las clases agrupadas: llega a 0.99 aunque el modelo dude entre sarna y cancro, y así el umbral no atrapa las antracnosis mal clasificadas.
- Dividir entrenamiento, validación y prueba ANTES de aumentar datos. Las imágenes sintéticas del dataset de fresa van solo en entrenamiento.
- Las cajas de fresa para el detector se generan con un script a partir de las máscaras de sus datasets.
- Pesos en `api/models/`. No subir archivos grandes al repo; documentar de dónde se descargan.
- Datasets: MangoDHDS, MangoFruitBD, Tomato Pathologies, INDTomatoMSTD, TFDD, Tomato Disease (Sichuan), Strawberry Disease (Mendeley), Strawberry Disease Detection. Citarlos en README.md.

## Sugerencias y contenido agronómico
- Salen de la tabla `fichas`, escrita y verificada por el equipo con su fuente. NUNCA inventes causas, tratamientos, productos ni dosis.
- El LLM es opcional: solo reescribe el texto de una ficha en lenguaje amigable y siempre agrega "confirma con un técnico agrícola".

## Reglas del hackatón que afectan cómo trabajas
- Responde siempre en español: explicaciones, preguntas y resúmenes al terminar cada tarea.
- Todo el código se escribe durante el evento. Cita en README.md los datasets, modelos y librerías usados.
- El equipo debe entender y defender todo el código: prefiere soluciones simples y legibles, comenta solo lo que no es obvio y al terminar cada tarea explica en pocas líneas las decisiones importantes.
- `AI_LOG.md`: después de cada tarea agrega una fila con fecha y hora, qué se pidió, qué generaste y qué archivos tocaste. Deja vacía la columna "Qué cambió el equipo" para que la llene una persona.
- Commits pequeños y frecuentes, con mensajes en español en imperativo (ej. "Agrega trigger de destino"). No hagas push si no te lo piden.

## Seguridad
- Nunca escribas llaves en el código ni las subas al repo. Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en web; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en api. Mantén `.env.example` al día y `.env` en `.gitignore`.
- La service role key solo existe en `api/`.

## Estilo
- Interfaz en español, con textos cortos y claros para productores.
- Python con tipos y routers de FastAPI. TypeScript en modo estricto.
- Nombres de dominio iguales a la base de datos (lote, fruto, destino, grado); el resto del código puede ir en inglés.
