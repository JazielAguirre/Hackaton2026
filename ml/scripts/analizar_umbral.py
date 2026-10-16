"""Analiza un umbral de confianza propio para una clase de la base de datos.

Uso:
    python ml/scripts/analizar_umbral.py                                # en val: para elegir el umbral
    python ml/scripts/analizar_umbral.py --split test --umbrales 0.85   # en test: solo para confirmar

Simula lo que hará el trigger de frutos: un fruto va a revision_manual si su
confianza queda bajo el umbral general (configuracion.umbral_confianza) o, si su
clase tiene umbral propio, bajo ese umbral. Por defecto analiza otro_defecto de
mango, donde caen por error algunas antracnosis.

La clase de la base sale de la clase más probable del modelo (sarna ->
otro_defecto). Su confianza puede medirse de dos formas (--confianza):
- top1: probabilidad de la clase del modelo (sarna 0.76). Baja cuando el modelo
  duda entre sarna, cancro_bacteriano y antracnosis.
- suma: suma de las clases del modelo que forman la clase de la base
  (sarna 0.76 + cancro_bacteriano 0.23 = 0.99). Solo baja si duda entre clases
  de la base distintas.
"""

import argparse
from collections import defaultdict
from pathlib import Path

import numpy as np

from comun import MODELS_DIR, PROCESSED_DIR, list_images, load_class_map


def predict_db(weights: Path, split_dir: Path, to_db: dict[str, str], confidence: str) -> list[dict]:
    """Clase real, clase predicha y confianza de cada foto, con las clases de la base."""
    from ultralytics import YOLO

    model = YOLO(weights)
    rows = []
    for class_dir in sorted(d for d in split_dir.iterdir() if d.is_dir()):
        for r in model.predict([str(p) for p in list_images(class_dir)], device="cpu", verbose=False, stream=True):
            probs = defaultdict(float)
            for i, p in enumerate(r.probs.data.tolist()):
                probs[to_db[model.names[i]]] += p
            pred = to_db[model.names[r.probs.top1]]
            conf = float(r.probs.top1conf) if confidence == "top1" else probs[pred]
            rows.append({"real": to_db[class_dir.name], "pred": pred, "conf": conf, "foto": Path(r.path).name})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pesos", type=Path, default=MODELS_DIR / "clasificador_mango" / "best.pt")
    parser.add_argument("--fruta", default="mango")
    parser.add_argument("--split", default="val", choices=["val", "test"])
    parser.add_argument("--clase", default="otro_defecto", help="clase de la base con umbral propio")
    parser.add_argument("--error", default="antracnosis", help="clase real que no queremos que se cuele en --clase")
    parser.add_argument("--confianza", choices=["top1", "suma"], default="top1",
                        help="cómo se mide la confianza que guarda la API en conf_clasificacion")
    parser.add_argument("--general", type=float, default=0.60, help="configuracion.umbral_confianza")
    parser.add_argument("--umbrales", type=float, nargs="+", default=list(np.round(np.arange(0.60, 0.951, 0.05), 2)))
    parser.add_argument("--max-revision", type=float, default=0.10, help="fracción máxima de frutos a revisión")
    args = parser.parse_args()

    to_db = load_class_map(args.fruta)["modelo_a_bd"]
    rows = predict_db(args.pesos, PROCESSED_DIR / "clasificador" / args.fruta / args.split, to_db, args.confianza)
    n = len(rows)
    correct = [r for r in rows if r["pred"] == r["real"]]
    slipped = [r for r in rows if r["real"] == args.error and r["pred"] == args.clase]
    print(f"Confianza: {args.confianza}")
    print(f"{args.split}: {n} fotos, {len(correct)} bien clasificadas, "
          f"{len(slipped)} {args.error} clasificadas como {args.clase}:")
    for r in slipped:
        print(f"  {r['foto']}: confianza {r['conf']:.3f}")

    print(f"\nUmbral para {args.clase} (el resto usa {args.general:.2f}):")
    print(f"{'umbral':>7} | {args.error + ' atrapadas':>22} | {'bien clasificadas a revisión':>28} | {'total a revisión':>16}")
    results = []
    for t in args.umbrales:
        def to_review(r: dict) -> bool:
            return r["conf"] < args.general or (r["pred"] == args.clase and r["conf"] < t)

        caught = sum(to_review(r) for r in slipped)
        good = sum(to_review(r) for r in correct)
        total = sum(to_review(r) for r in rows)
        print(f"{t:>7.2f} | {caught:>13} de {len(slipped):<6} | {good:>9} ({100 * good / len(correct):5.1f} %){'':>11} | "
              f"{total:>4} ({100 * total / n:5.1f} %)")
        if total / n <= args.max_revision:
            results.append((t, caught))
    if results:
        most = max(c for _, c in results)
        tied = [t for t, c in results if c == most]
        print(f"\nAtrapan {most} de {len(slipped)} sin pasar de {100 * args.max_revision:.0f} % a revisión: "
              f"umbrales {tied[0]:.2f} a {tied[-1]:.2f}. Entre ellos se elige a criterio (margen contra costo).")


if __name__ == "__main__":
    main()
