"""Evalúa el detector: métricas en un split y fotos con cajas dibujadas.

Uso:
    python ml/scripts/evaluar_detector.py                          # métricas en test
    python ml/scripts/evaluar_detector.py --fotos ruta/a/fotos/     # además dibuja cajas en esas fotos

Por defecto usa ml/modelos/detector/best.pt y el tamaño de imagen con el que se
entrenó. Las fotos con cajas quedan en ml/runs/<nombre>/.
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

from comun import MODELS_DIR, PROCESSED_DIR, RUNS_DIR


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pesos", type=Path, default=MODELS_DIR / "detector" / "best.pt")
    parser.add_argument("--data", type=Path, default=PROCESSED_DIR / "detector" / "mango" / "data.yaml")
    parser.add_argument("--split", default="test", choices=["train", "val", "test"])
    parser.add_argument("--fotos", type=Path, help="carpeta con fotos para dibujar las cajas detectadas")
    parser.add_argument("--conf", type=float, default=0.25, help="confianza mínima para dibujar una caja")
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="cpu", help="cpu, o 0 para la primera GPU")
    parser.add_argument("--nombre", default="evaluar_detector", help="subcarpeta dentro de ml/runs/")
    args = parser.parse_args()

    model = YOLO(args.pesos)
    print(f"Pesos: {args.pesos} · clases: {model.names} · imgsz de entrenamiento: {model.overrides.get('imgsz')}")

    result = model.val(data=str(args.data.resolve()), split=args.split, batch=args.batch, device=args.device,
                       project=str(RUNS_DIR), name=f"{args.nombre}_{args.split}", verbose=False)
    box = result.box
    print(f"\n{args.split}: mAP50 {box.map50:.3f} · mAP50-95 {box.map:.3f} · "
          f"precisión {box.mp:.3f} · recall {box.mr:.3f}")
    print(f"Gráficas (curva PR, matriz de confusión): {result.save_dir}")

    if args.fotos:
        results = model.predict(source=str(args.fotos), conf=args.conf, device=args.device, save=True,
                                project=str(RUNS_DIR), name=f"{args.nombre}_fotos", stream=True, verbose=False)
        counts = [len(r.boxes) for r in results]  # stream=True: procesa una foto a la vez
        save_dir = model.predictor.save_dir
        print(f"\n{len(counts)} fotos, {sum(counts)} frutos detectados. Fotos con cajas en: {save_dir}")


if __name__ == "__main__":
    main()
