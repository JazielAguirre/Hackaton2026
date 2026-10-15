"""Entrena el clasificador de mango con Ultralytics (YOLO classify).

Uso:
    python ml/scripts/entrenar_clasificador.py                         # CPU, valores por defecto
    python ml/scripts/entrenar_clasificador.py --device 0 --batch 64   # con GPU (Colab)

Antes hay que correr preparar_clasificador.py. Al terminar copia best.pt a
ml/modelos/clasificador_mango/ y guarda en metricas.json la exactitud, el F1
macro y la matriz de confusión del split test (fotos que el modelo nunca vio).
"""

import argparse
import json
import shutil
import time
from pathlib import Path

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

from comun import MODELS_DIR, PROCESSED_DIR, RUNS_DIR, default_workers, list_images, load_base_model


def evaluate_test(weights: Path, test_dir: Path, device: str, batch: int) -> dict:
    """Predice cada foto de test y compara con su carpeta (la clase real)."""
    from ultralytics import YOLO

    model = YOLO(weights)
    classes = [model.names[i] for i in sorted(model.names)]
    y_true, y_pred = [], []
    for class_dir in sorted(d for d in test_dir.iterdir() if d.is_dir()):
        images = [str(p) for p in list_images(class_dir)]
        for start in range(0, len(images), batch):
            results = model.predict(images[start:start + batch], device=device, verbose=False)
            y_pred += [model.names[r.probs.top1] for r in results]
            y_true += [class_dir.name] * len(results)

    report = classification_report(y_true, y_pred, labels=classes, output_dict=True, zero_division=0)
    return {
        "split": "test",
        "imagenes": len(y_true),
        "exactitud": round(accuracy_score(y_true, y_pred), 4),
        "f1_macro": round(f1_score(y_true, y_pred, labels=classes, average="macro", zero_division=0), 4),
        "matriz_confusion": {
            "orden": "filas = clase real, columnas = clase predicha",
            "clases": classes,
            "valores": confusion_matrix(y_true, y_pred, labels=classes).tolist(),
        },
        "por_clase": {c: {"precision": round(report[c]["precision"], 4), "recall": round(report[c]["recall"], 4),
                          "f1": round(report[c]["f1-score"], 4), "fotos": int(report[c]["support"])}
                      for c in classes},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=PROCESSED_DIR / "clasificador" / "mango",
                        help="carpeta con train/, val/ y test/")
    parser.add_argument("--modelo", default="yolo26n-cls.pt", help="modelo preentrenado o ruta a un .pt")
    parser.add_argument("--respaldo", default="yolo11n-cls.pt", help="modelo si el anterior no descarga")
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--patience", type=int, default=5, help="épocas sin mejorar antes de parar")
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--workers", type=int, default=default_workers())
    parser.add_argument("--device", default="cpu", help="cpu, o 0 para la primera GPU")
    parser.add_argument("--nombre", default="clasificador_mango", help="subcarpeta dentro de ml/runs/")
    parser.add_argument("--salida", type=Path, default=MODELS_DIR / "clasificador_mango",
                        help="dónde copiar best.pt y metricas.json")
    args = parser.parse_args()

    model, base = load_base_model(args.modelo, args.respaldo)
    print(f"Modelo base: {base} · device {args.device} · batch {args.batch} · workers {args.workers}")

    start = time.perf_counter()
    model.train(data=str(args.data), imgsz=args.imgsz, epochs=args.epochs, patience=args.patience,
                batch=args.batch, workers=args.workers, device=args.device, seed=42,
                project=str(RUNS_DIR), name=args.nombre)
    seconds = time.perf_counter() - start

    args.salida.mkdir(parents=True, exist_ok=True)
    best = args.salida / "best.pt"
    shutil.copy2(model.trainer.best, best)

    metrics = evaluate_test(best, args.data / "test", args.device, args.batch)
    metrics["entrenamiento"] = {
        "modelo_base": base,
        "epochs_pedidas": args.epochs,
        "epochs_completadas": model.trainer.epoch + 1,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "device": args.device,
        "segundos": round(seconds),
        "carpeta_run": str(Path(model.trainer.save_dir).relative_to(RUNS_DIR.parent)),
    }
    (args.salida / "metricas.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n")

    print(f"\nEntrenamiento: {seconds / 60:.1f} min ({metrics['entrenamiento']['epochs_completadas']} épocas)")
    print(f"Test: exactitud {metrics['exactitud']:.3f} · F1 macro {metrics['f1_macro']:.3f}")
    print(f"Pesos y métricas en {args.salida}")


if __name__ == "__main__":
    main()
