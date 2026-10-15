"""Rutas y utilidades que comparten los scripts de entrenamiento."""

import hashlib
from pathlib import Path

# Todas las rutas salen de la ubicación de este archivo, así los scripts
# funcionan igual en local, en Colab o en otra computadora.
ML_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = ML_DIR / "data" / "raw"
PROCESSED_DIR = ML_DIR / "data" / "processed"

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
