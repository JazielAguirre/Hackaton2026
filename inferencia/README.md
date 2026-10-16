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
| `/app/models/clasificador_<fruta>.pt` | `api/models/clasificador_<fruta>.pt` | Un clasificador por fruta. Hoy solo existe el de mango. |
| `/app/mapeo_clases.json` | `ml/config/mapeo_clases.json` | Clase del modelo → código de `clases.codigo` en la BD. Mismo archivo que usa `ml/` para entrenar. |

Los pesos son los `best.pt` que entrena `ml/` (ver el README de la raíz, sección *Entrenar los modelos*): el equipo los comparte en la carpeta `FruitScan/modelos/` de Google Drive. Cópialos a `api/models/` con esos nombres.

Una fruta sin `clasificador_<fruta>.pt` (jitomate y fresa por ahora) se detecta, pero sus frutos salen sin clase y la base los manda a `revision_manual`.

## Rutas

| Ruta | Respuesta |
| --- | --- |
| `GET /salud` | `version` (huella de los pesos), clases del detector y de cada clasificador. |
| `POST /inferir` | Multipart con el campo `foto`. Devuelve `frutos` (fruta, caja normalizada 0–1 con esquina superior izquierda + ancho/alto, `conf_deteccion`, `clase_modelo`, `clase_bd`, `conf_clasificacion`) y `modelo_version`. |

`conf_clasificacion` es la probabilidad top-1 de la clase que predice el modelo, **antes** de agrupar `cancro_bacteriano` y `sarna` en `otro_defecto` (no se suman las clases agrupadas).

## Detalles de la imagen

- `YOLO_AUTOINSTALL=False`, `YOLO_OFFLINE=True`, `YOLO_CONFIG_DIR=/tmp`: Ultralytics no instala paquetes ni sale a internet mientras atiende fotos.
- `pi-heif` acepta fotos HEIC de iPhone; sin él Ultralytics intenta instalarlo en el primer archivo que no abre.
- `opencv-python-headless` reemplaza a `opencv-python` (la imagen slim no trae librerías gráficas).
- Corre como `nobody`.
