"""Entrena el detector de frutos con Ultralytics (YOLO detect).

Uso:
    python ml/scripts/entrenar_detector.py                                       # CPU, valores por defecto
    python ml/scripts/entrenar_detector.py --device 0 --imgsz 640 --batch 32 --freeze 0 --cache ram   # GPU

Los valores por defecto están pensados para CPU: fotos de 480 px, batch 8 y las
primeras 10 capas congeladas (se entrena menos y va más rápido). Antes hay que
correr preparar_detector.py. Al terminar copia best.pt a ml/modelos/detector/ y
guarda en metricas.json mAP50, mAP50-95, precisión y recall de val y test.
"""

import argparse
import json
import shutil
import time
from pathlib import Path

import psutil

from comun import MODELS_DIR, PROCESSED_DIR, RUNS_DIR, default_workers, list_images, load_base_model


def choose_cache(choice: str, data_yaml: Path, imgsz: int) -> str | bool:
    """Con "auto" guarda las fotos de train en RAM solo si caben con margen."""
    if choice != "auto":
        return False if choice == "no" else choice
    n_images = len(list_images(data_yaml.parent / "images" / "train"))
    # Ultralytics guarda cada foto reducida a imgsz en el lado largo; las fotos son casi todas 4:3.
    needed_gb = n_images * imgsz * (imgsz * 3 / 4) * 3 / 1e9
    free_gb = psutil.virtual_memory().available / 1e9
    fits = needed_gb < free_gb / 2  # deja la otra mitad para el modelo y el sistema
    print(f"Caché: hacen falta ~{needed_gb:.1f} GB y hay {free_gb:.1f} GB libres -> "
          f"{'en RAM' if fits else 'sin caché (cierra otros programas para usar RAM)'}")
    return "ram" if fits else False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=PROCESSED_DIR / "detector" / "mango" / "data.yaml")
    parser.add_argument("--modelo", default="yolo26n.pt", help="modelo preentrenado o ruta a un .pt")
    parser.add_argument("--respaldo", default="yolo11n.pt", help="modelo si el anterior no descarga")
    parser.add_argument("--imgsz", type=int, default=480)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--patience", type=int, default=8, help="épocas sin mejorar antes de parar")
    parser.add_argument("--freeze", type=int, default=10, help="capas iniciales congeladas (0 = ninguna)")
    parser.add_argument("--cache", choices=["auto", "ram", "disk", "no"], default="auto")
    parser.add_argument("--workers", type=int, default=default_workers())
    parser.add_argument("--device", default="cpu", help="cpu, o 0 para la primera GPU")
    parser.add_argument("--nombre", default="detector_mango", help="subcarpeta dentro de ml/runs/")
    parser.add_argument("--salida", type=Path, default=MODELS_DIR / "detector",
                        help="dónde copiar best.pt y metricas.json")
    args = parser.parse_args()

    data = args.data.resolve()  # ruta absoluta: Ultralytics busca las carpetas junto al yaml
    model, base = load_base_model(args.modelo, args.respaldo)
    cache = choose_cache(args.cache, data, args.imgsz)
    print(f"Modelo base: {base} · device {args.device} · imgsz {args.imgsz} · batch {args.batch} · "
          f"freeze {args.freeze} · workers {args.workers}")

    start = time.perf_counter()
    model.train(data=str(data), imgsz=args.imgsz, batch=args.batch, epochs=args.epochs,
                patience=args.patience, freeze=args.freeze, cache=cache, workers=args.workers,
                device=args.device, seed=42, project=str(RUNS_DIR), name=args.nombre)
    seconds = time.perf_counter() - start

    args.salida.mkdir(parents=True, exist_ok=True)
    best = args.salida / "best.pt"
    shutil.copy2(model.trainer.best, best)

    from ultralytics import YOLO

    metrics = {}
    for split in ("val", "test"):
        result = YOLO(best).val(data=str(data), split=split, batch=args.batch, device=args.device,
                                project=str(RUNS_DIR), name=f"{args.nombre}_{split}", verbose=False)
        box = result.box
        metrics[split] = {"map50": round(float(box.map50), 4), "map50_95": round(float(box.map), 4),
                          "precision": round(float(box.mp), 4), "recall": round(float(box.mr), 4)}
    metrics["entrenamiento"] = {
        "modelo_base": base,
        "epochs_pedidas": args.epochs,
        "epochs_completadas": model.trainer.epoch + 1,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "freeze": args.freeze,
        "cache": cache,
        "device": args.device,
        "segundos": round(seconds),
        "carpeta_run": str(Path(model.trainer.save_dir).relative_to(RUNS_DIR.parent)),
    }
    (args.salida / "metricas.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n")

    print(f"\nEntrenamiento: {seconds / 60:.1f} min ({metrics['entrenamiento']['epochs_completadas']} épocas)")
    for split in ("val", "test"):
        m = metrics[split]
        print(f"{split}: mAP50 {m['map50']:.3f} · mAP50-95 {m['map50_95']:.3f} · "
              f"precisión {m['precision']:.3f} · recall {m['recall']:.3f}")
    print(f"Pesos y métricas en {args.salida}")


if __name__ == "__main__":
    main()
