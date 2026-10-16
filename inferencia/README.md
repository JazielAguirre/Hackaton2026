# Servicio de inferencia

Corre los modelos de ML (detector de frutos + un clasificador por fruta) en CPU y los expone por HTTP. La API (`api/`) lo llama al analizar un lote. **No guarda nada ni decide destinos o grados**: eso lo hacen el trigger de `frutos` y `cerrar_analisis_lote()` en la base de datos.

Es una preclasificación visual, no una certificación de exportación.

## Levantarlo

Desde la raíz del repo:

```bash
docker compose up -d --build inferencia
curl 127.0.0.1:8001/salud     # versión de los pesos y clases del detector y de cada clasificador
docker compose logs -f inferencia
docker compose down           # detenerlo
```

- Solo escucha en `127.0.0.1:8001` (no tiene autenticación; no lo expongas a la red).
- La API lo busca en `INFERENCIA_URL` (`api/.env`, por defecto `http://127.0.0.1:8001`).
- La primera construcción baja torch para CPU (~2 GB de imagen); las siguientes usan caché.
- Si cambias los pesos no hace falta reconstruir: `docker compose restart inferencia`.

## De dónde salen los archivos

`docker-compose.yml` los monta en solo lectura; no van dentro de la imagen ni en git (`*.pt` está ignorado):

| En el contenedor | Origen en el repo | Qué es |
| --- | --- | --- |
| `/app/models/detector_mango.pt` | `api/models/detector_mango.pt` | Detector YOLO nano con 3 clases (mango, jitomate, fresa). |
| `/app/models/clasificador_<fruta>.pt` | `api/models/clasificador_<fruta>.pt` | Un clasificador por fruta. Hoy existen mango, jitomate y fresa. |
| `/app/mapeo_clases.json` | `ml/config/mapeo_clases.json` | Clase del modelo → código de `clases.codigo` en la BD. Mismo archivo que usa `ml/` para entrenar. |

Los pesos son los `best.pt` que entrena `ml/` (ver el README de la raíz, sección *Entrenar los modelos*): el equipo los comparte en la carpeta `FruitScan/modelos/` de Google Drive. Cópialos a `api/models/` con esos nombres.

Una fruta sin `clasificador_<fruta>.pt` se detecta, pero sus frutos salen sin clase y la base los manda a `revision_manual`.

## Qué fruta se clasifica

El detector se entrenó solo con cajas de mango (`ml/scripts/preparar_detector.py`: todas son clase 0), así que nunca dice jitomate ni fresa. Por eso la API manda la fruta del lote (`lotes.fruta_principal`) en el campo opcional `fruta` de `/inferir`:

- **Con `fruta`** (`mango`, `jitomate` o `fresa`): cada caja detectada se toma como esa fruta y se clasifica con `clasificador_<fruta>.pt`. Otro valor → 422. Si esa fruta no tiene clasificador, el fruto sale con `clase_modelo`, `clase_bd` y `conf_clasificacion` en `null`.
- **Sin `fruta`** (lote sin fruta): se usa la fruta que dice el detector, como antes.

Límites actuales: el detector solo ubica bien mangos, así que en fotos de jitomate o fresa las cajas pueden ser pobres hasta reentrenarlo con las 3 frutas. El clasificador de jitomate no aprendió `dano_fisico`: esa clase nunca saldrá (solo `pudricion_mancha` y `sano`).

### Cambiar o agregar un clasificador

1. Copia los pesos a `api/models/clasificador_<fruta>.pt` (el servicio los lee al arrancar).
2. Agrega la fruta en `ml/config/mapeo_clases.json` con `modelo_a_bd`: clase del modelo → `clases.codigo` de la BD.
3. Reconstruye: `docker compose up -d --build inferencia` (si solo cambias pesos, basta `docker compose restart inferencia`). Revisa que `GET /salud` liste la fruta.

## Rutas

| Ruta | Respuesta |
| --- | --- |
| `GET /salud` | `version` (huella de los pesos), clases del detector y de cada clasificador. |
| `POST /inferir` | Multipart con el campo `foto` y el campo opcional `fruta` (ver *Qué fruta se clasifica*). Devuelve `frutos` (fruta, caja normalizada 0–1 con esquina superior izquierda + ancho/alto, `conf_deteccion`, `clase_modelo`, `clase_bd`, `conf_clasificacion`) y `modelo_version`. |

`conf_clasificacion` es la probabilidad top-1 de la clase que predice el modelo, **antes** de agrupar `cancro_bacteriano` y `sarna` en `otro_defecto` (no se suman las clases agrupadas).

## Detalles de la imagen

- `YOLO_AUTOINSTALL=False`, `YOLO_OFFLINE=True`, `YOLO_CONFIG_DIR=/tmp`: Ultralytics no instala paquetes ni sale a internet mientras atiende fotos.
- `pi-heif` acepta fotos HEIC de iPhone; sin él Ultralytics intenta instalarlo en el primer archivo que no abre.
- `opencv-python-headless` reemplaza a `opencv-python` (la imagen slim no trae librerías gráficas).
- Corre como `nobody`.
