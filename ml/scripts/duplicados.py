"""Casi duplicados con hash perceptual (pHash).

Dos fotos casi iguales (la misma con otro brillo, ruido, giro o volteo) dan
hashes perceptuales parecidos. La distancia entre hashes es el número de bits
distintos (de 64): 0 = idénticas a la vista; cuanto más alta, más diferentes.
"""

from pathlib import Path

import imagehash
import numpy as np
from PIL import Image, ImageDraw, ImageOps

# Las 8 orientaciones de una foto: 4 giros de 90° con y sin volteo.
ORIENTATIONS = [
    None,
    Image.Transpose.ROTATE_90,
    Image.Transpose.ROTATE_180,
    Image.Transpose.ROTATE_270,
    Image.Transpose.FLIP_LEFT_RIGHT,
    Image.Transpose.FLIP_TOP_BOTTOM,
    Image.Transpose.TRANSPOSE,
    Image.Transpose.TRANSVERSE,
]


def load_small(path: Path, size: int = 256) -> Image.Image:
    """Abre la foto en gris, girada según EXIF y reducida (el pHash usa 32x32)."""
    with Image.open(path) as img:
        img.draft("L", (size, size))  # los JPEG grandes se decodifican ya reducidos
        img = ImageOps.exif_transpose(img).convert("L")
    img.thumbnail((size, size))
    return img


def perceptual_hashes(path: Path) -> np.ndarray:
    """pHash de la foto en sus 8 orientaciones, como enteros de 64 bits."""
    img = load_small(path)
    hashes = [imagehash.phash(img if t is None else img.transpose(t)) for t in ORIENTATIONS]
    return np.array([int(str(h), 16) for h in hashes], dtype=np.uint64)


def distance_matrix(hashes: np.ndarray) -> np.ndarray:
    """Distancia mínima entre cada par de fotos, probando las 8 orientaciones."""
    original = hashes[:, 0]
    best = np.full((len(hashes), len(hashes)), 64, dtype=np.uint8)
    for k in range(hashes.shape[1]):
        best = np.minimum(best, np.bitwise_count(original[:, None] ^ hashes[None, :, k]))
    return np.minimum(best, best.T)


def near_duplicate_pairs(dist: np.ndarray, threshold: int) -> list[tuple[int, int, int]]:
    """Pares (i, j, distancia) de la matriz de distancias con distancia <= threshold."""
    rows, cols = np.nonzero(np.triu(dist <= threshold, k=1))
    return [(int(i), int(j), int(dist[i, j])) for i, j in zip(rows, cols)]


def group_ids(n: int, pairs: list[tuple[int, int, int]]) -> list[int]:
    """Número de grupo por foto: si A~B y B~C, las tres quedan en el mismo grupo."""
    parent = list(range(n))

    def root(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, j, _ in pairs:
        parent[root(i)] = root(j)
    return [root(x) for x in range(n)]


def save_pairs_sheet(pairs: list[tuple[Path, Path, str]], out: Path, size: int = 180, columns: int = 4) -> None:
    """Guarda una hoja JPG con pares de fotos lado a lado y un texto debajo de cada par."""
    rows = max(1, -(-len(pairs) // columns))
    cell_w, cell_h = 2 * size + 16, size + 34
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for n, (a, b, caption) in enumerate(pairs):
        x, y = (n % columns) * cell_w, (n // columns) * cell_h
        for k, path in enumerate((a, b)):
            sheet.paste(_thumbnail(path, size), (x + k * size, y))
        for line_no, line in enumerate(caption.split("\n")[:2]):
            draw.text((x, y + size + 2 + 14 * line_no), line, fill="black")
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=85)


def _thumbnail(path: Path, size: int) -> Image.Image:
    with Image.open(path) as img:
        img.draft("RGB", (size * 2, size * 2))
        img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((size, size))
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas
