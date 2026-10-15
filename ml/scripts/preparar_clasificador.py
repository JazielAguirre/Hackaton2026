"""Prepara el dataset del clasificador de mango (MangoDHDS) en formato ImageFolder.

Uso:
    python ml/scripts/preparar_clasificador.py             # escribe el dataset
    python ml/scripts/preparar_clasificador.py --simular   # solo muestra qué haría

Pasos:
1. Traduce las carpetas del dataset a las clases del modelo (ml/config/mapeo_clases.json).
2. Quita duplicados exactos (mismo archivo): se queda la primera copia.
3. Quita las fotos que aparecen con dos clases distintas (pHash a distancia <= 2):
   no sabemos cuál etiqueta es la buena.
4. Agrupa casi duplicados (pHash en 8 orientaciones) para que cada grupo quede
   completo en un solo split.
5. Divide 70/15/15 por grupos, estratificado por clase, con semilla 42. Aquí no se
   aumentan datos: Ultralytics aumenta al entrenar y solo sobre train.
6. Copia a ml/data/processed/clasificador/mango/{train,val,test}/<clase>/,
   escribe manifest.csv, un zip para subir a Drive y los conteos en
   ml/data/revision/resumen_limpieza.json.
"""

import argparse
import random
import shutil
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from comun import PROCESSED_DIR, RAW_DIR, REVIEW_DIR, file_hash, list_images, load_class_map, save_cleaning_summary
from duplicados import distance_matrix, group_ids, near_duplicate_pairs, perceptual_hashes, save_pairs_sheet

SEED = 42
# Hasta esta distancia todos los pares revisados eran la misma foto; si tienen
# clases distintas es un error de etiqueta del dataset.
CONFLICT_DISTANCE = 2
DEST = PROCESSED_DIR / "clasificador" / "mango"


def load_images(root: Path, class_map: dict[str, str]) -> pd.DataFrame:
    rows = []
    for folder, clase in class_map.items():
        for path in list_images(root / folder):
            rows.append({"origen": path, "clase_original": folder, "clase": clase, "sha256": file_hash(path)})
    return pd.DataFrame(rows)


def split_by_group(df: pd.DataFrame) -> pd.Series:
    """70 % train, 15 % val y 15 % test por grupos, estratificado por la clase del grupo."""
    group_class = df.groupby("grupo")["clase"].agg(lambda c: c.mode()[0])
    train, rest = train_test_split(group_class.index, test_size=0.30, stratify=group_class, random_state=SEED)
    val, test = train_test_split(rest, test_size=0.50, stratify=group_class[rest], random_state=SEED)
    split_of = {g: "train" for g in train} | {g: "val" for g in val} | {g: "test" for g in test}
    return df["grupo"].map(split_of)


def balance_table(df: pd.DataFrame) -> pd.DataFrame:
    table = pd.crosstab(df["clase"], df["split"], margins=True, margins_name="total")
    return table[["train", "val", "test", "total"]]


def print_balance(table: pd.DataFrame) -> None:
    print("\nBalance final (imágenes por clase y split):")
    print(table.to_string())
    print("Porcentaje de cada split: " + ", ".join(
        f"{s} {100 * table.loc['total', s] / table.loc['total', 'total']:.1f} %" for s in ("train", "val", "test")))


def save_examples(df: pd.DataFrame, pairs: list[tuple[int, int, int]], out: Path) -> None:
    sample = random.Random(SEED).sample(pairs, min(24, len(pairs)))
    sheet = []
    for i, j, d in sorted(sample, key=lambda p: p[2]):
        a, b = df.loc[i, "origen"], df.loc[j, "origen"]
        sheet.append((a, b, f"{a.parent.name}/{a.name} | {b.parent.name}/{b.name}\ndistancia {d}"))
    save_pairs_sheet(sheet, out)
    print(f"Ejemplos de casi duplicados: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--origen", type=Path, default=RAW_DIR / "mango" / "mangodhds" / "imagenes")
    parser.add_argument("--umbral", type=int, default=4,
                        help="distancia pHash máxima (de 64 bits) para considerar dos fotos casi duplicadas")
    parser.add_argument("--simular", action="store_true", help="muestra el resumen sin escribir el dataset")
    args = parser.parse_args()

    df = load_images(args.origen, load_class_map("mango")["dataset_a_modelo"])
    print(f"Imágenes leídas: {len(df)}")
    summary = {"umbral_casi_duplicados": args.umbral, "umbral_conflicto_etiqueta": CONFLICT_DISTANCE,
               "imagenes_leidas": len(df)}

    exact = df.duplicated("sha256")
    exact_by_class = {c: int(n) for c, n in df[exact]["clase"].value_counts().items()}
    print(f"\nDuplicados exactos quitados: {exact.sum()} "
          f"({', '.join(f'{c} {n}' for c, n in exact_by_class.items())})")
    summary["duplicados_exactos_quitados"] = {"total": int(exact.sum()), "por_clase": exact_by_class}
    df = df[~exact].reset_index(drop=True)

    dist = distance_matrix(np.stack([perceptual_hashes(p) for p in df["origen"]]))
    conflicts = sorted({k for i, j, _ in near_duplicate_pairs(dist, CONFLICT_DISTANCE)
                        if df.loc[i, "clase"] != df.loc[j, "clase"] for k in (i, j)})
    conflict_names = [f"{df.loc[k, 'clase_original']}/{df.loc[k, 'origen'].name}" for k in conflicts]
    print(f"\nMisma foto con dos clases (distancia <= {CONFLICT_DISTANCE}), se quitan: "
          f"{', '.join(conflict_names) or 'ninguna'}")
    summary["conflictos_de_etiqueta_quitados"] = conflict_names
    keep = ~df.index.isin(conflicts)
    df, dist = df[keep].reset_index(drop=True), dist[np.ix_(keep, keep)]

    pairs = near_duplicate_pairs(dist, args.umbral)
    df["grupo"] = pd.factorize(pd.Series(group_ids(len(df), pairs)))[0]
    sizes = df["grupo"].value_counts()
    by_distance = {int(d): n for d, n in sorted(Counter(d for *_, d in pairs).items())}
    mixed = int((df.groupby("grupo")["clase"].nunique() > 1).sum())
    print(f"\nCasi duplicados (distancia <= {args.umbral}): {len(pairs)} pares, por distancia {by_distance}")
    print(f"  Grupos con más de una foto: {(sizes > 1).sum()} ({sizes[sizes > 1].sum()} fotos); "
          f"el más grande tiene {sizes.max()}")
    print(f"  Grupos con fotos de clases distintas: {mixed}")
    summary["casi_duplicados"] = {
        "pares": len(pairs), "pares_por_distancia": by_distance,
        "grupos_con_mas_de_una_foto": int((sizes > 1).sum()), "fotos_en_esos_grupos": int(sizes[sizes > 1].sum()),
        "grupo_mas_grande": int(sizes.max()), "grupos_con_clases_distintas": mixed,
    }
    if pairs:
        save_examples(df, pairs, REVIEW_DIR / "casi_duplicados_mangodhds.jpg")

    df["split"] = split_by_group(df)
    table = balance_table(df)
    print_balance(table)
    summary["balance_final"] = {c: {s: int(n) for s, n in row.items()} for c, row in table.iterrows()}

    if args.simular:
        print("\nSimulación: no se escribió nada.")
        return

    if DEST.exists():
        shutil.rmtree(DEST)
    files = []
    for row in df.itertuples():
        target = DEST / row.split / row.clase / row.origen.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(row.origen, target)
        files.append(target.relative_to(DEST).as_posix())

    manifest = df.assign(archivo=files, origen=[p.relative_to(RAW_DIR).as_posix() for p in df["origen"]])
    manifest[["archivo", "split", "clase", "clase_original", "grupo", "origen", "sha256"]].to_csv(
        DEST / "manifest.csv", index=False)
    zip_path = shutil.make_archive(str(PROCESSED_DIR / "clasificador_mango"), "zip",
                                   root_dir=PROCESSED_DIR, base_dir=DEST.relative_to(PROCESSED_DIR))
    print(f"\nDataset escrito en {DEST}\nZip para Drive: {zip_path}")
    print(f"Conteos de la limpieza: {save_cleaning_summary('mangodhds', summary)}")


if __name__ == "__main__":
    main()
