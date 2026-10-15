"""Prepara el dataset del detector con MangoFruitBD en formato YOLO.

Uso:
    python ml/scripts/preparar_detector.py             # escribe el dataset
    python ml/scripts/preparar_detector.py --simular   # solo muestra qué haría

Pasos:
1. Respeta la división train/val/test del dataset: ninguna foto cambia de split.
2. Quita duplicados y fugas entre splits:
   - duplicado exacto dentro del mismo split: se queda una copia;
   - casi duplicado (pHash en 8 orientaciones) de una foto de train: sale de val/test;
   - casi duplicado entre val y test sin copia en train: sale de test;
   - las 83 fotos aumentadas del dataset (Alternaria de 640x640, ver su README)
     solo se usan en train, igual que las sintéticas de fresa.
3. Gira cada foto según EXIF (las cajas están hechas sobre la foto ya girada) y
   la reduce a 1280 px en el lado largo.
4. Todas las cajas pasan a la clase 0 = mango; las fotos sin fruto quedan como
   negativas (etiqueta vacía).
5. Valida pares imagen-etiqueta y cajas entre 0 y 1, escribe data.yaml, un zip
   para subir a Drive y los conteos en ml/data/revision/resumen_limpieza.json.
"""

import argparse
import random
import shutil
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageOps

from comun import PROCESSED_DIR, RAW_DIR, REVIEW_DIR, file_hash, list_images, save_cleaning_summary
from duplicados import distance_matrix, group_ids, near_duplicate_pairs, perceptual_hashes, save_pairs_sheet

SPLITS = ("train", "val", "test")
DEST = PROCESSED_DIR / "detector" / "mango"

# Sin clave "path": así Ultralytics busca las carpetas junto a este archivo,
# esté donde esté (local, Colab u otra computadora).
DATA_YAML = """\
# Detector de FruitScan. Rutas relativas a este archivo.
train: images/train
val: images/val
test: images/test

names: [mango, jitomate, fresa]
"""


def load_dataset(root: Path) -> pd.DataFrame:
    rows = []
    for split in SPLITS:
        for path in list_images(root / "images" / split):
            with Image.open(path) as img:
                size = img.size
            rows.append({
                "origen": path,
                "etiqueta": root / "labels" / split / f"{path.stem}.txt",
                "split": split,
                "sha256": file_hash(path),
                # El README de MangoFruitBD dice que 83 fotos de Alternaria son
                # aumentadas (giro, volteo, brillo, ruido); son las de 640x640.
                "aumentada": path.stem.startswith("Alternaria") and size == (640, 640),
            })
    return pd.DataFrame(rows)


def removal_reasons(df: pd.DataFrame) -> pd.Series:
    """Motivo por el que se quita cada foto; vacío si se queda."""
    reason = pd.Series("", index=df.index)

    def mark(mask: pd.Series, text: str) -> None:
        reason[mask & (reason == "")] = text

    mark(df.duplicated(["sha256", "split"]), "duplicado exacto en el mismo split")
    for _, members in df.groupby("grupo"):
        splits = set(members["split"])
        if "train" in splits:
            mark(df.index.isin(members.index) & (df["split"] != "train"), "casi duplicado de una foto de train")
        elif {"val", "test"} <= splits:
            mark(df.index.isin(members.index) & (df["split"] == "test"), "casi duplicado de una foto de val")
    mark(df["aumentada"] & (df["split"] != "train"), "foto aumentada (solo va en train)")
    return reason


def save_examples(df: pd.DataFrame, dist: np.ndarray, out: Path) -> None:
    """Hoja con cada foto quitada de val/test junto a su casi duplicado más cercano que se queda."""
    sheet = []
    for i in df.index[df["motivo"].str.startswith("casi duplicado")]:
        keep_split = "train" if "train" in df.loc[i, "motivo"] else "val"
        twins = df.index[(df["grupo"] == df.loc[i, "grupo"]) & (df["split"] == keep_split)]
        j = min(twins, key=lambda t: dist[i, t])
        a, b = df.loc[i, "origen"], df.loc[j, "origen"]
        sheet.append((a, b, f"quita {df.loc[i, 'split']}/{a.stem} | {keep_split}/{b.stem}\ndistancia {dist[i, j]}"))
    sheet = sorted(random.Random(42).sample(sheet, min(24, len(sheet))), key=lambda s: int(s[2].split()[-1]))
    save_pairs_sheet(sheet, out)
    print(f"Ejemplos de lo que se quita: {out}")


def write_image(src: Path, dst: Path, max_side: int) -> None:
    with Image.open(src) as img:
        img.draft("RGB", (max_side, max_side))  # JPEG grande: decodifica ya reducido (más rápido)
        img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    img.save(dst, quality=90)


def mango_label(src: Path) -> str:
    """Las mismas cajas, todas como clase 0 = mango. Sin cajas, archivo vacío (negativa)."""
    lines = [line.split() for line in src.read_text().splitlines() if line.strip()]
    return "".join(" ".join(["0", *parts[1:]]) + "\n" for parts in lines)


def validate(dest: Path) -> list[str]:
    problems = []
    for split in SPLITS:
        images = {p.stem for p in list_images(dest / "images" / split)}
        labels = {p.stem: p for p in (dest / "labels" / split).glob("*.txt")}
        problems += [f"{split}: imagen sin etiqueta: {s}" for s in sorted(images - labels.keys())]
        problems += [f"{split}: etiqueta sin imagen: {s}" for s in sorted(labels.keys() - images)]
        for stem, label in labels.items():
            for line in label.read_text().splitlines():
                parts = line.split()
                if len(parts) != 5 or parts[0] != "0":
                    problems.append(f"{split}/{stem}: línea inválida '{line}'")
                    continue
                x, y, w, h = map(float, parts[1:])
                eps = 1e-6
                if not (w > 0 and h > 0 and x - w / 2 >= -eps and x + w / 2 <= 1 + eps
                        and y - h / 2 >= -eps and y + h / 2 <= 1 + eps):
                    problems.append(f"{split}/{stem}: caja fuera de 0-1 '{line}'")
    return problems


def final_table(kept: pd.DataFrame) -> pd.DataFrame:
    kept = kept.assign(cajas=[len(mango_label(p).splitlines()) for p in kept["etiqueta"]])
    return kept.groupby("split").agg(imagenes=("origen", "size"), cajas=("cajas", "sum"),
                                     negativas=("cajas", lambda c: (c == 0).sum()),
                                     aumentadas=("aumentada", "sum")).loc[list(SPLITS)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--origen", type=Path, default=RAW_DIR / "mango" / "mangofruitbd" / "MangoFruitBD")
    parser.add_argument("--umbral", type=int, default=10,
                        help="distancia pHash máxima (de 64 bits) para considerar dos fotos casi duplicadas")
    parser.add_argument("--max-lado", type=int, default=1280, help="lado largo máximo de las fotos, en px")
    parser.add_argument("--simular", action="store_true", help="muestra el resumen sin escribir el dataset")
    args = parser.parse_args()

    df = load_dataset(args.origen)
    read = {s: int(n) for s, n in df["split"].value_counts()[list(SPLITS)].items()}
    print(f"Imágenes leídas: {len(df)} ({', '.join(f'{s} {n}' for s, n in read.items())})")
    print(f"Fotos aumentadas detectadas: {df['aumentada'].sum()} (el README dice 83)")
    summary = {"umbral_casi_duplicados": args.umbral, "imagenes_leidas": read,
               "aumentadas": {s: int(n) for s, n in df[df["aumentada"]]["split"].value_counts().items()}}

    dist = distance_matrix(np.stack([perceptual_hashes(p) for p in df["origen"]]))
    pairs = near_duplicate_pairs(dist, args.umbral)
    df["grupo"] = group_ids(len(df), pairs)
    crossing = sum(df.loc[i, "split"] != df.loc[j, "split"] for i, j, _ in pairs)
    by_distance = {int(d): n for d, n in sorted(Counter(d for *_, d in pairs).items())}
    print(f"\nCasi duplicados (distancia <= {args.umbral}): {len(pairs)} pares, {crossing} entre splits distintos")
    print(f"  por distancia: {by_distance}")
    summary["casi_duplicados"] = {"pares": len(pairs), "pares_por_distancia": by_distance,
                                  "pares_entre_splits": int(crossing)}

    df["motivo"] = removal_reasons(df)
    removed = df[df["motivo"] != ""]
    reasons = pd.crosstab(removed["motivo"], removed["split"]).reindex(columns=list(SPLITS), fill_value=0)
    print(f"\nFotos que se quitan: {len(removed)}")
    print(reasons.to_string())
    summary["quitadas"] = {m: {s: int(n) for s, n in row.items()} for m, row in reasons.iterrows()}
    summary["quitadas_por_split"] = {s: int(reasons[s].sum()) for s in SPLITS}
    summary["quitadas_lista"] = sorted(f"{r.split}/{r.origen.name}: {r.motivo}" for r in removed.itertuples())
    save_examples(df, dist, REVIEW_DIR / "casi_duplicados_mangofruitbd.jpg")

    kept = df[df["motivo"] == ""]
    table = final_table(kept)
    print("\nDataset final:")
    print(table.to_string())
    summary["final"] = {s: {k: int(v) for k, v in row.items()} for s, row in table.iterrows()}

    if args.simular:
        print("\nSimulación: no se escribió nada.")
        return

    if DEST.exists():
        shutil.rmtree(DEST)
    for split in SPLITS:
        (DEST / "images" / split).mkdir(parents=True)
        (DEST / "labels" / split).mkdir(parents=True)
    for n, row in enumerate(kept.itertuples(), 1):
        write_image(row.origen, DEST / "images" / row.split / f"{row.origen.stem}.jpg", args.max_lado)
        (DEST / "labels" / row.split / f"{row.origen.stem}.txt").write_text(mango_label(row.etiqueta))
        if n % 200 == 0:
            print(f"  {n}/{len(kept)} fotos escritas")
    (DEST / "data.yaml").write_text(DATA_YAML)

    problems = validate(DEST)
    if problems:
        print(f"\nLa validación encontró {len(problems)} problemas:")
        print("\n".join(problems[:30]))
        sys.exit(1)
    print("\nValidación correcta: cada imagen tiene su etiqueta y todas las cajas están entre 0 y 1.")

    zip_path = shutil.make_archive(str(PROCESSED_DIR / "detector_mango"), "zip",
                                   root_dir=PROCESSED_DIR, base_dir=DEST.relative_to(PROCESSED_DIR))
    print(f"Dataset escrito en {DEST}\nZip para Drive: {zip_path}")
    print(f"Conteos de la limpieza: {save_cleaning_summary('mangofruitbd', summary)}")


if __name__ == "__main__":
    main()
