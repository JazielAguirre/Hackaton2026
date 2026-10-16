# Servicio de inferencia (detector + clasificadores) en CPU. Se levanta con docker-compose.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    MODELOS_DIR=/app/models MAPEO_CLASES=/app/mapeo_clases.json \
    # Ultralytics no debe instalar paquetes ni salir a internet mientras atiende fotos.
    YOLO_AUTOINSTALL=False YOLO_OFFLINE=True YOLO_CONFIG_DIR=/tmp
WORKDIR /app

# torch para CPU: unas 10 veces más ligero que la versión con CUDA de PyPI.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.1 torchvision==0.29.1

# Ultralytics instala opencv-python, que pide librerías gráficas que no hay en la imagen slim:
# se cambia por opencv-python-headless (misma API, sin interfaz gráfica).
# pi-heif: fotos HEIC de iPhone; sin él, Ultralytics intenta instalarlo al primer archivo que no abre.
RUN pip install ultralytics==8.4.170 pillow==12.3.0 fastapi==0.143.2 "uvicorn[standard]==0.54.0" \
        python-multipart==0.0.32 pi-heif \
    && pip uninstall -y opencv-python \
    && pip install opencv-python-headless==4.14.0.94

COPY servicio.py ./

# Ni los pesos ni el mapeo de clases van dentro de la imagen: docker-compose.yml los monta en
# /app/models y /app/mapeo_clases.json (así un modelo nuevo no obliga a reconstruir).
USER nobody
EXPOSE 8000
CMD ["uvicorn", "servicio:app", "--host", "0.0.0.0", "--port", "8000"]
