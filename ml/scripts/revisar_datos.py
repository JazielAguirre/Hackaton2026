"""Revisa los datasets crudos de mango antes de prepararlos.

Uso:
    python ml/scripts/revisar_datos.py

Para cada dataset muestra imágenes por clase y por split, tamaños, archivos
dañados y duplicados exactos por hash. En MangoFruitBD también cuenta cajas
por clase, imágenes sin etiqueta y cajas inválidas.
"""

import argparse
import re
from collections import Counter
from pathlib import Path

import pandas as pd
import yaml
from PIL import Image

from comun import RAW_DIR, file_hash, list_images

EXIF_ORIENTATION = 0x0112


def inspect_image(path: Path) -> dict:
    """Tamaño, orientación EXIF y si el archivo se puede decodificar."""
    try:
        with Image.open(path) as img:
            width, height = img.size
            orientation = img.getexif().get(EXIF_ORIENTATION, 1)
            # draft decodifica el JPEG a 1/8 de resolución: es rápido y aun
            # así falla si el archivo está truncado o dañado.
            img.draft("RGB", (width // 8, height // 8))
            img.load()
        return {"ancho": width, "alto": height, "orientacion": orientation, "error": None}
    except Exception as e:  # cualquier fallo al abrir cuenta como dañado
        return {"ancho": None, "alto": None, "orientacion": None, "error": str(e)}


def print_title(text: str) -> None:
    print(f"\n{'=' * 70}\n{text}\n{'=' * 70}")


def print_sizes(df: pd.DataFrame) -> None:
    ok = df[df["error"].isna()]
    sizes = Counter(zip(ok["ancho"], ok["alto"]))
    print("\nTamaños más comunes (ancho x alto: imágenes):")
    for (w, h), n in sizes.most_common(5):
        print(f"  {w} x {h}: {n}")
    print(f"  Lado largo: mín {int(ok[['ancho', 'alto']].max(axis=1).min())} px, "
          f"máx {int(ok[['ancho', 'alto']].max(axis=1).max())} px")
    rotated = int((ok["orientacion"] != 1).sum())
    print(f"  Con rotación EXIF (orientación != 1): {rotated}")


def print_damaged(df: pd.DataFrame) -> None:
    damaged = df[df["error"].notna()]
    print(f"\nArchivos dañados: {len(damaged)}")
    for _, row in damaged.iterrows():
        print(f"  {row['archivo']}: {row['error']}")


def print_duplicates(df: pd.DataFrame, group_col: str) -> None:
    """Duplicados exactos; avisa si un mismo archivo cae en grupos distintos."""
    groups = df.groupby("sha256")["archivo"].apply(list)
    groups = groups[groups.apply(len) > 1]
    extra = int(groups.apply(len).sum() - len(groups))
    print(f"\nDuplicados exactos: {len(groups)} grupos ({extra} archivos sobrantes)")
    group_of = df.set_index("archivo")[group_col]
    crossed = [g for g in groups if group_of[g].nunique() > 1]
    print(f"  Grupos repartidos entre distintos '{group_col}': {len(crossed)}")
    for files in list(groups)[:10]:
        print("  - " + " | ".join(f"{f} [{group_of[f]}]" for f in files))
    if len(groups) > 10:
        print(f"  ... y {len(groups) - 10} grupos más")


def review_mangodhds(root: Path) -> None:
    print_title(f"MangoDHDS (clasificador) — {root}")
    rows = []
    for class_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for path in list_images(class_dir):
            rows.append({
                "archivo": str(path.relative_to(root)),
                "clase": class_dir.name,
                "sha256": file_hash(path),
                **inspect_image(path),
            })
    df = pd.DataFrame(rows)

    print("Sin división en el dataset original (la hace preparar_clasificador.py).")
    print("\nImágenes por clase:")
    print(df["clase"].value_counts().sort_index().to_string())
    print(f"Total: {len(df)}")
    print_sizes(df)
    print_damaged(df)
    print_duplicates(df, "clase")


def review_mangofruitbd(root: Path) -> None:
    print_title(f"MangoFruitBD (detector) — {root}")
    names = yaml.safe_load((root / "data.yaml").read_text())["names"]
    print(f"Clases en data.yaml: {names}")

    rows, boxes, invalid = [], [], []
    for split in ("train", "val", "test"):
        image_dir, label_dir = root / "images" / split, root / "labels" / split
        images = list_images(image_dir)
        image_stems = {p.stem for p in images}
        for label in sorted(label_dir.glob("*.txt")):
            if label.stem not in image_stems:
                invalid.append((str(label.relative_to(root)), "etiqueta sin imagen"))

        for path in images:
            label = label_dir / f"{path.stem}.txt"
            lines = label.read_text().split("\n") if label.exists() else []
            lines = [line for line in lines if line.strip()]
            for line in lines:
                parts = line.split()
                problem = None
                try:
                    cls, x, y, w, h = int(parts[0]), *map(float, parts[1:])
                except ValueError:
                    problem = f"línea mal formada: {line}"
                else:
                    if cls not in names:
                        problem = f"clase desconocida {cls}"
                    elif not all(0 <= v <= 1 for v in (x, y, w, h)) or w <= 0 or h <= 0:
                        problem = f"coordenadas fuera de 0-1: {line}"
                    else:
                        boxes.append({"split": split, "clase": names[cls]})
                if problem:
                    invalid.append((str(label.relative_to(root)), problem))

            # El nombre del archivo dice de qué tipo es la foto: Healthy (12).jpg, Mixed (3).jpg...
            category = re.match(r"[A-Za-z]+", path.stem)
            rows.append({
                "archivo": str(path.relative_to(root)),
                "split": split,
                "categoria": category.group(0) if category else "?",
                "etiqueta": "falta" if not label.exists() else ("vacía" if not lines else "con cajas"),
                "cajas": len(lines),
                "sha256": file_hash(path),
                **inspect_image(path),
            })
    df = pd.DataFrame(rows)
    df_boxes = pd.DataFrame(boxes)

    print("\nImágenes por categoría (según el nombre del archivo) y split:")
    print(pd.crosstab(df["categoria"], df["split"], margins=True, margins_name="total")
          [["train", "val", "test", "total"]].to_string())
    print("\nCajas por clase y split:")
    print(pd.crosstab(df_boxes["clase"], df_boxes["split"], margins=True, margins_name="total")
          [["train", "val", "test", "total"]].to_string())
    print("\nEstado de la etiqueta por split (vacía = negativa, sin fruto):")
    print(pd.crosstab(df["etiqueta"], df["split"])[["train", "val", "test"]].to_string())
    print(f"\nCajas por imagen: máx {df['cajas'].max()}, "
          f"imágenes con más de una caja: {(df['cajas'] > 1).sum()}")

    print(f"\nEtiquetas con problemas: {len(invalid)}")
    for name, problem in invalid[:20]:
        print(f"  {name}: {problem}")

    print_sizes(df)
    print_damaged(df)
    print_duplicates(df, "split")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mangodhds", type=Path, default=RAW_DIR / "mango" / "mangodhds" / "imagenes")
    parser.add_argument("--mangofruitbd", type=Path, default=RAW_DIR / "mango" / "mangofruitbd" / "MangoFruitBD")
    args = parser.parse_args()

    review_mangodhds(args.mangodhds)
    review_mangofruitbd(args.mangofruitbd)


if __name__ == "__main__":
    main()
