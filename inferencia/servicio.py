"""Servicio de inferencia: detecta frutos en una foto, clasifica cada uno y los devuelve.

No guarda nada en la base de datos ni decide destinos o grados: de eso se encarga la API
(con el trigger y las funciones de la base). Aquí solo se corre el modelo.
"""
import hashlib
import io
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from ultralytics import YOLO

MODELOS_DIR = Path(os.environ.get("MODELOS_DIR", "models"))
# Se monta desde ml/config/mapeo_clases.json (docker-compose.yml); no se copia a mano.
MAPEO_CLASES = Path(os.environ.get("MAPEO_CLASES", "mapeo_clases.json"))

FRUTAS = ("mango", "jitomate", "fresa")

modelos: dict = {"clasificadores": {}}


def _huella(*archivos: Path) -> str:
    """Identifica la versión de los pesos: si se cambia un archivo, cambia la versión."""
    resumen = hashlib.sha256()
    for archivo in archivos:
        resumen.update(archivo.read_bytes())
    return resumen.hexdigest()[:10]


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Se cargan una sola vez al arrancar, no en cada petición.
    t0 = time.perf_counter()
    mapeo = json.loads(MAPEO_CLASES.read_text())
    detector = MODELOS_DIR / "detector_mango.pt"
    modelos["detector"] = YOLO(detector, task="detect")
    pesos = [detector]
    # Un clasificador por fruta. Una fruta sin pesos se detecta, pero sus frutos salen sin clase
    # y la base los manda a revisión manual.
    for fruta, datos in mapeo.items():
        if fruta.startswith("_"):
            continue
        archivo = MODELOS_DIR / f"clasificador_{fruta}.pt"
        if archivo.exists():
            modelos["clasificadores"][fruta] = {
                "modelo": YOLO(archivo, task="classify"),
                "a_bd": datos["modelo_a_bd"],
            }
            pesos.append(archivo)
    modelos["version"] = _huella(*pesos)
    print(f"Modelos cargados en {time.perf_counter() - t0:.1f} s (versión {modelos['version']})", flush=True)
    yield


app = FastAPI(title="Inferencia de FruitScan", lifespan=lifespan)


@app.get("/salud")
def salud() -> dict:
    return {
        "version": modelos["version"],
        "detector": modelos["detector"].names,
        "clasificadores": {f: c["modelo"].names for f, c in modelos["clasificadores"].items()},
    }


@app.post("/inferir")
def inferir(foto: UploadFile = File(...), fruta: str | None = Form(None)) -> dict:
    """Con `fruta`, todas las cajas se toman como esa fruta (el detector solo aprendió mango).
    Sin `fruta`, cada caja usa la fruta que dice el detector."""
    if fruta is not None and fruta not in FRUTAS:
        raise HTTPException(422, f"Fruta no soportada: usa {', '.join(FRUTAS)}")
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(foto.file.read()))).convert("RGB")
    except Exception as error:
        raise HTTPException(422, "No es una imagen válida") from error

    t0 = time.perf_counter()
    deteccion = modelos["detector"].predict(img, imgsz=480, conf=0.25, device="cpu", verbose=False)[0]
    t_detector = time.perf_counter() - t0

    ancho, alto = img.size
    nombres = modelos["detector"].names
    cajas = deteccion.boxes.xyxyn.tolist()
    frutas = [fruta or nombres[int(c)] for c in deteccion.boxes.cls.tolist()]
    recortes = [img.crop((int(x1 * ancho), int(y1 * alto), int(x2 * ancho), int(y2 * alto))) for x1, y1, x2, y2 in cajas]

    frutos = []
    for (x1, y1, x2, y2), fruta_caja, conf, recorte in zip(cajas, frutas, deteccion.boxes.conf.tolist(), recortes):
        fruto = {
            "fruta": fruta_caja,
            "caja_x": round(x1, 4), "caja_y": round(y1, 4),
            "caja_ancho": round(x2 - x1, 4), "caja_alto": round(y2 - y1, 4),
            "conf_deteccion": round(conf, 3),
            "clase_modelo": None, "clase_bd": None, "conf_clasificacion": None,
        }
        clasificador = modelos["clasificadores"].get(fruta_caja)
        if clasificador is not None:
            resultado = clasificador["modelo"].predict(recorte, imgsz=224, device="cpu", verbose=False)[0]
            clase = clasificador["modelo"].names[resultado.probs.top1]
            fruto["clase_modelo"] = clase
            fruto["clase_bd"] = clasificador["a_bd"][clase]
            # Probabilidad top-1 de la clase del modelo, antes de agrupar clases en la BD.
            fruto["conf_clasificacion"] = round(float(resultado.probs.top1conf), 3)
        frutos.append(fruto)

    return {
        "frutos": frutos,
        "modelo_version": modelos["version"],
        "ms_detector": round(1000 * t_detector),
        "ms_total": round(1000 * (time.perf_counter() - t0)),
    }
