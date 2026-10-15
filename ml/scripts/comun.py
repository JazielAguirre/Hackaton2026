"""Rutas y utilidades que comparten los scripts de entrenamiento."""

import hashlib
import json
from pathlib import Path

# Todas las rutas salen de la ubicación de este archivo, así los scripts
# funcionan igual en local, en Colab o en otra computadora.
ML_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = ML_DIR / "data" / "raw"
PROCESSED_DIR = ML_DIR / "data" / "processed"
REVIEW_DIR = ML_DIR / "data" / "revision"
CONFIG_DIR = ML_DIR / "config"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def list_images(folder: Path) -> list[Path]:
    """Imágenes de una carpeta (sin subcarpetas), en orden estable."""
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def file_hash(path: Path) -> str:
    """SHA-256 del archivo: dos archivos con el mismo hash son duplicados exactos."""
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_class_map(fruit: str) -> dict:
    """Mapeo de clases de una fruta desde ml/config/mapeo_clases.json."""
    return json.loads((CONFIG_DIR / "mapeo_clases.json").read_text())[fruit]


def save_cleaning_summary(dataset: str, data: dict) -> Path:
    """Guarda los conteos de la limpieza de un dataset en ml/data/revision/resumen_limpieza.json."""
    path = REVIEW_DIR / "resumen_limpieza.json"
    summary = json.loads(path.read_text()) if path.exists() else {}
    summary[dataset] = data
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    return path

