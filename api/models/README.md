# Pesos de los modelos

Los entrena el equipo con los scripts de `ml/`. Van en git (unos 15 MB en total) para que cualquiera pueda probar con un `git pull`.

| Archivo | Modelo | Clases |
| --- | --- | --- |
| `detector_mango.pt` | Detector YOLO (imgsz 480). Pese al nombre, distingue las tres frutas | mango, jitomate, fresa |
| `clasificador_mango.pt` | Clasificador YOLO-cls (imgsz 224) | antracnosis, cancro_bacteriano, pudricion_pedunculo, sano, sarna |
| `clasificador_jitomate.pt` | Clasificador YOLO-cls | pudricion_mancha, sano |
| `clasificador_fresa.pt` | Clasificador YOLO-cls | antracnosis, moho_gris, oidio_fruto, sana |

`cancro_bacteriano` y `sarna` se agrupan en `otro_defecto` con `ml/config/mapeo_clases.json`.

## Probar en tu laptop
1. Servicio de inferencia (Docker; monta esta carpeta): `docker compose up -d --build inferencia` desde la raíz. `curl 127.0.0.1:8001/salud` debe listar el detector y los tres clasificadores.
2. API y web: sigue los comandos de `CLAUDE.md` (copia `api/.env.example` y `frontend/.env.example` y llénalos).

Si cambias un `.pt`, reinicia el servicio: `docker compose restart inferencia`.
