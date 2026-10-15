# FruitScan

Control de calidad visual de fruta por lote: el productor toma o sube fotos, el sistema detecta cada fruto, lo clasifica, le asigna un destino y le da un grado al lote. Es una preclasificación visual, no una certificación de exportación.

Proyecto del Hackatón LSC 2026, equipo Los Claudios.

## Entrenar los modelos

Todo lo de entrenamiento vive en `ml/`: scripts en `ml/scripts/`, mapeo de clases en `ml/config/mapeo_clases.json` y notebook de Colab en `ml/notebooks/`. Los datos (`ml/data/`), los pesos (`*.pt`) y las corridas (`ml/runs/`) no se suben a git.

| Modelo | Base | Datos | Resultado |
| --- | --- | --- | --- |
| Clasificador de mango (5 clases) | `yolo26n-cls.pt` (respaldo `yolo11n-cls.pt`) | MangoDHDS | `ml/modelos/clasificador_mango/` |
| Detector de frutos (por ahora solo mango) | `yolo26n.pt` (respaldo `yolo11n.pt`) | MangoFruitBD | `ml/modelos/detector/` |

Cada carpeta de resultado tiene `best.pt` y `metricas.json`:
- **Clasificador:** exactitud, F1 macro, matriz de confusión y métricas por clase en test.
- **Detector:** mAP50, mAP50-95, precisión y recall en val y test.

Los pesos base se descargan solos a `ml/modelos/base/`. Para no subir pesos a git, el equipo comparte los `best.pt` entrenados en la carpeta `FruitScan/modelos/` de Google Drive.

### 1. Descargar los datos crudos

Descarga los dos datasets de Mendeley (links en [Datasets, modelos y librerías](#datasets-modelos-y-librerías)) y descomprímelos así. Los dos traen zips dentro del zip:

```bash
cd ml/data/raw/mango

# MangoDHDS: el zip trae un zip por clase
unzip -q "mangodhds/MangoDHDS A Dataset of Diseased and Healthy Mangoe.zip" -d mangodhds
for z in mangodhds/*/ZIP-FILES_IMAGES/*.zip; do unzip -q "$z" -d mangodhds/imagenes; done

# MangoFruitBD: el zip trae otro zip con el dataset
unzip -q "mangofruitbd/MangoFruitBD A Bounding-Box Annotated Image Datase.zip" -d mangofruitbd/_tmp
unzip -q mangofruitbd/_tmp/*/MangoFruitBD.zip -d mangofruitbd && rm -r mangofruitbd/_tmp
```

Deben quedar `ml/data/raw/mango/mangodhds/imagenes/<clase>/*.jpg` y `ml/data/raw/mango/mangofruitbd/MangoFruitBD/{images,labels}/{train,val,test}/`.

### 2. En local, con CPU

Instala el entorno; el índice extra baja torch para CPU, mucho más ligero que la versión con CUDA:

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
cd ..
```

Revisa y prepara los datos (detalle en [Limpieza de datos](#limpieza-de-datos)):

```bash
python ml/scripts/revisar_datos.py              # conteos, dañadas, duplicados
python ml/scripts/preparar_clasificador.py      # agrega --simular para ver sin escribir
python ml/scripts/preparar_detector.py
```

Entrena y evalúa:

```bash
python ml/scripts/entrenar_clasificador.py
python ml/scripts/entrenar_detector.py
python ml/scripts/evaluar_detector.py --fotos ruta/a/fotos   # dibuja cajas en tus fotos
```

Valores por defecto para CPU (todos se cambian por línea de comandos; ve `--help`):

| | imgsz | batch | épocas | paciencia | otros |
| --- | ---: | ---: | ---: | ---: | --- |
| Clasificador | 224 | 32 | 20 | 5 | |
| Detector | 480 | 8 | 30 | 8 | 10 capas congeladas; caché en RAM solo si cabe |

Tiempos medidos con 1 época, en una laptop con Intel i5-1235U (10 núcleos, 12 hilos), 7.5 GB de RAM y sin GPU:

| Modelo | Por época | Entrenamiento completo | RAM máxima |
| --- | ---: | ---: | ---: |
| Clasificador | ~30 s | 20 épocas ≈ 10 min | 1.3 GB |
| Detector | ~2.2 min (con validación) | 30 épocas ≈ 1 h 10 min | 2.3 GB (con caché en RAM) |

Si el modelo deja de mejorar, la paciencia lo detiene antes. Si la laptop se calienta, puede tardar más.

Consejos para CPU:
- **Cierra el navegador antes de entrenar.** El detector guarda las fotos en RAM si hay espacio, y eso lo hace más rápido.
- **Workers:** se usa un tercio de los hilos del CPU para cargar imágenes; el resto entrena.
- **Si te quedas sin memoria,** baja `--batch` o usa `--cache no`.

### 3. En Google Colab, con GPU

1. Corre en tu computadora los dos scripts `preparar_*.py`. Generan `ml/data/processed/clasificador_mango.zip` y `ml/data/processed/detector_mango.zip`.
2. Sube los dos zips a la carpeta `FruitScan/` de tu Google Drive.
3. Sube la rama a GitHub (`git push`). El notebook clona el repo desde ahí; ajusta la variable `RAMA` si hace falta.
4. Abre `ml/notebooks/entrenar_colab.ipynb` en Colab y elige *Entorno de ejecución → GPU T4*.
5. Ejecuta todas las celdas.

El notebook monta Drive, instala `requirements.txt` (sin torch, que Colab ya trae con CUDA), descomprime los datos y entrena los dos modelos. También copia `best.pt`, `metricas.json` y las gráficas a `FruitScan/modelos/` en Drive.

En GPU usa más épocas, fotos de 640 px y ninguna capa congelada en el detector.

### 4. En otra computadora con GPU (NVIDIA)

Instala sin el índice de CPU, para que pip baje torch con CUDA:

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Para los datos, descomprime los dos zips de `ml/data/processed/` en esa misma carpeta, o repite los pasos 1 y 2 de preparación. Después entrena con la GPU:

```bash
python ml/scripts/entrenar_clasificador.py --device 0 --batch 64 --epochs 50 --patience 10
python ml/scripts/entrenar_detector.py --device 0 --imgsz 640 --batch 32 --epochs 100 --patience 20 --freeze 0
python ml/scripts/evaluar_detector.py --device 0
```

## Limpieza de datos

Antes de entrenar se quitan duplicados para que ninguna foto de validación o prueba (val/test) tenga una copia en entrenamiento (train). Si la tuviera, las métricas saldrían mejores de lo que el modelo es en realidad. Los scripts `ml/scripts/preparar_clasificador.py` y `ml/scripts/preparar_detector.py` hacen toda la limpieza; con `--simular` muestran qué harían sin escribir nada.

### Cómo se buscan los duplicados

- **Duplicados exactos:** mismo archivo byte a byte (hash SHA-256).
- **Casi duplicados:** la misma foto con otro brillo, ruido, giro o volteo. Se compara el hash perceptual (pHash de 64 bits, librería `imagehash`) de cada foto contra las 8 orientaciones de la otra: 4 giros de 90° con y sin volteo. La distancia es cuántos de los 64 bits cambian; 0 significa que se ven iguales.
- **Umbrales:** se eligieron revisando a ojo pares de fotos en cada distancia.
  - **MangoDHDS: distancia ≤ 4.** Todas las fotos son un mango centrado sobre fondo blanco, así que hasta mangos distintos quedan cerca (el vecino típico está a 8 o 10). Hasta 2, todos los pares revisados eran la misma foto. En 4, la mitad eran mangos distintos. Aquí los casi duplicados solo se agrupan (no se quitan), así que un falso positivo solo obliga a que dos fotos queden en el mismo split; por eso conviene un umbral que deje escapar menos fugas.
  - **MangoFruitBD: distancia ≤ 10.** Son escenas variadas. Hasta 8, todos los pares eran la misma foto; en 10, 31 de 33 pares eran el mismo mango (otra toma, otro color o girado); de 12 en adelante casi todos son mangos distintos. Aquí los casi duplicados se quitan de val/test, así que importa más no equivocarse. Se conoce un falso positivo: `val/Healthy (402)` se quita sin ser copia de nada.

### MangoDHDS (clasificador)

| Paso | Fotos |
| --- | --- |
| Leídas (5 clases × 300) | 1500 |
| Duplicados exactos quitados (sano 51, antracnosis 48, cancro_bacteriano 1) | −100 |
| Misma foto con dos clases, se quitan las dos: `Bacterial Canker/Bc101.jpg` y `Scab/Sc252.jpg` (distancia 2) | −2 |
| **Quedan** | **1398** |

- **Casi duplicados:** 100 pares (56 a distancia 0, 16 a 2, 28 a 4) que forman 80 grupos con 173 fotos; el grupo más grande tiene 10. Varios son la misma foto girada o en espejo.
- **Grupos con clases distintas:** 5, todos falsos positivos a distancia 4 (mangos distintos). No pasa nada: cada foto conserva su clase y solo quedan en el mismo split.
- **División:** se divide por grupos, de modo que cada grupo queda completo en un solo split. Es 70/15/15, estratificada por clase, con semilla 42 y antes de cualquier aumento de datos.

| clase | train | val | test | total |
| --- | ---: | ---: | ---: | ---: |
| antracnosis | 174 | 38 | 40 | 252 |
| cancro_bacteriano | 209 | 45 | 44 | 298 |
| pudricion_pedunculo | 208 | 48 | 44 | 300 |
| sano | 167 | 45 | 37 | 249 |
| sarna | 209 | 44 | 46 | 299 |
| **total** | **967** | **220** | **211** | **1398** |

El modelo aprende 5 clases. La API junta `cancro_bacteriano` y `sarna` en `otro_defecto` al guardar en la base (mapeo en `ml/config/mapeo_clases.json`).

### MangoFruitBD (detector)

Se respeta la división original del dataset: ninguna foto cambia de split, solo se quitan copias. Se encontraron 148 pares de casi duplicados (105 exactos, 8 a distancia 6, 2 a 8, 33 a 10); 46 cruzan splits.

| Motivo por el que se quita | train | val | test |
| --- | ---: | ---: | ---: |
| Duplicado exacto dentro del mismo split (se queda una copia) | 71 | 1 | 1 |
| Casi duplicado de una foto de train | 0 | 20 | 16 |
| Casi duplicado de una foto de val (sin copia en train) | 0 | 0 | 3 |
| Foto aumentada (solo va en train) | 0 | 11 | 9 |
| **Total quitadas** | **71** | **32** | **29** |

| split | leídas | quedan | cajas | negativas (sin fruto) |
| --- | ---: | ---: | ---: | ---: |
| train | 1048 | 977 | 1610 | 19 |
| val | 131 | 99 | 178 | 2 |
| test | 131 | 102 | 197 | 3 |

En 103 de los duplicados exactos, la misma foto aparece como `Alternaria` y como `Anthracnose`. Al detector no le afecta, porque todas las cajas pasan a la clase `mango`, pero muestra que las clases de enfermedad de este dataset no son confiables.

### Regla de las fotos aumentadas

Según su README, MangoFruitBD incluye 83 fotos de Alternaria generadas a partir de otras con giro, volteo, brillo y ruido. Son las fotos de Alternaria de 640×640: 63 en train, 11 en val y 9 en test.

Además de esas transformaciones tienen recortes, giros en ángulos arbitrarios y cuadros negros, así que no se pudo encontrar el original de cada una. Con pHash, su vecino más cercano está a distancia 14 a 18, donde ya son mangos distintos. Con puntos clave (SIFT) las coincidencias salían con el fondo de piedra que comparten todas las fotos de estudio, no con el mango.

Por eso la regla es la misma que para las imágenes sintéticas de fresa: **las fotos aumentadas solo se usan en train**. Se quitan las 20 que estaban en val/test, tenga o no su original en train.

**Limitación:** no se puede detectar el caso contrario, una foto original en val/test cuya copia aumentada está en train. Si pasa, las métricas de val/test del detector pueden salir un poco optimistas.

### Dónde quedan los resultados

En `ml/data/revision/` (no se sube a git):
- `resumen_limpieza.json`: todos los conteos de esta sección, incluida la lista de fotos quitadas y su motivo.
- `casi_duplicados_mangodhds.jpg` y `casi_duplicados_mangofruitbd.jpg`: hojas de ejemplos para revisar a ojo.

## Umbral de confianza

El error más caro del clasificador de mango es ver antracnosis como `sarna` o `cancro_bacteriano`. Las dos se guardan como `otro_defecto`, que va a `mercado_nacional` en vez de `separar`, y la antracnosis es justo la enfermedad poscosecha que se propaga. Para atrapar esos casos, `otro_defecto` de mango tiene su propio umbral: **0.85**. Si el modelo está menos seguro que eso, el fruto va a `revision_manual`. El resto de las clases sigue con el umbral general de 0.60.

### Cómo funciona

- `clases.umbral_confianza` es una columna opcional. Si tiene valor, el trigger de `frutos` la usa en vez de `configuracion.umbral_confianza` (migración `supabase/migrations/20261015223033_umbral_confianza_por_clase.sql`). Para cambiarlo basta un `update public.clases set umbral_confianza = ...`, sin tocar código.
- `frutos.conf_clasificacion` es la **probabilidad top-1 de la clase que predice el modelo**, antes de agrupar en `otro_defecto`. Si el modelo dice `sarna` con 0.76, se guarda 0.76, no la suma de `sarna` + `cancro_bacteriano`.

### Cómo se eligió 0.85 (solo con val)

El análisis está en `ml/scripts/analizar_umbral.py`. Simula el trigger sobre las 220 fotos de val:

| Umbral para `otro_defecto` | Antracnosis atrapadas | Bien clasificadas que van a revisión | Total a revisión |
| ---: | ---: | ---: | ---: |
| 0.60 (solo el general) | 0 de 1 | 5 (2.3 %) | 5 (2.3 %) |
| 0.65 | 1 de 1 | 6 (2.8 %) | 7 (3.2 %) |
| 0.70 | 1 de 1 | 7 (3.3 %) | 8 (3.6 %) |
| 0.75 | 1 de 1 | 10 (4.7 %) | 11 (5.0 %) |
| 0.80 | 1 de 1 | 11 (5.1 %) | 12 (5.5 %) |
| **0.85** | **1 de 1** | **15 (7.0 %)** | **16 (7.3 %)** |
| 0.90 | 1 de 1 | 23 (10.7 %) | 24 (10.9 %) |
| 0.95 | 1 de 1 | 32 (14.9 %) | 33 (15.0 %) |

- En val solo hay **una** antracnosis clasificada como `otro_defecto` (`An284`, confianza 0.608), así que la evidencia es poca. Cualquier umbral desde 0.65 la atrapa.
- Se eligió el umbral más alto que mantiene la revisión cerca de 1 de cada 10 frutos. Eso da el mayor margen contra errores que todavía no hemos visto.
- El equipo prefiere revisar 1 de cada 10 frutos a dejar pasar antracnosis. El 10 % es una guía, no un límite.

### Confirmación en test (no es ciega)

| Cómo se mide la confianza | Umbral | Antracnosis atrapadas | Total a revisión |
| --- | ---: | ---: | ---: |
| Suma de `sarna` + `cancro_bacteriano` (primer plan) | 0.90 | 0 de 3 | 1.4 % |
| Top-1 (lo que quedó) | 0.85 | 3 de 3 | 11.8 % |

**Aclaración:** el primer análisis medía la confianza de `otro_defecto` como la suma de `sarna` + `cancro_bacteriano`. Con esa medida, en val se había elegido 0.90. Al confirmarlo en test no atrapó ninguna de las 3 antracnosis mal clasificadas: el modelo repartía su probabilidad entre `sarna` y `cancro_bacteriano`, y la suma daba 0.999.

**El cambio de suma a top-1 se decidió viendo test**, así que esta confirmación en test no es ciega y el 3 de 3 es optimista. La prueba honesta será con fotos reales de campo.

## Datasets, modelos y librerías

### Datasets

| Dataset | Uso | Licencia | Enlace |
| --- | --- | --- | --- |
| MangoDHDS | Clasificador de mango | CC BY 4.0 | [Mendeley Data, V1](https://data.mendeley.com/datasets/b4nrw5hyyc/1) |
| MangoFruitBD | Detector (cajas de mango) | CC BY-NC (Mendeley indica 3.0; el `LICENSE.txt` del zip dice 4.0). **Solo uso no comercial.** | [Mendeley Data, V2](https://data.mendeley.com/datasets/bhrz29mkmr/2) |

Citas:
- Barhate, Priyanka; Barhate, Bhojraj; Joshi, Makarand (2025). *MangoDHDS: A Dataset of Diseased and Healthy Mangoes of 1.5 K Images*. Mendeley Data, V1. doi: [10.17632/b4nrw5hyyc.1](https://doi.org/10.17632/b4nrw5hyyc.1)
- Islam, Ariful; Oishi, Sadia Afroz; Hasan, Md. Maksudul; Ray, Sajeeb Kumar; Hossain, Md. Anwar; Islam, Naima; Kumar, Anomik (2026). *MangoFruitBD: A Bounding-Box Annotated Image Dataset for Detecting Healthy and Diseased Mango Fruits in Bangladeshi Orchards*. Mendeley Data, V2. doi: [10.17632/bhrz29mkmr.2](https://doi.org/10.17632/bhrz29mkmr.2)

Cambios hechos a los datos (las licencias CC BY piden indicarlos): se quitaron duplicados, se dividió MangoDHDS en train/val/test y sus clases se tradujeron al español. En MangoFruitBD, las fotos se giraron según EXIF y se redujeron a 1280 px, y todas las cajas pasaron a la clase `mango`. Ver [Limpieza de datos](#limpieza-de-datos).

### Modelos preentrenados

- `yolo26n-cls.pt` y `yolo26n.pt` de Ultralytics (respaldo: `yolo11n-cls.pt` y `yolo11n.pt`), con licencia AGPL-3.0.

### Librerías de entrenamiento (`ml/requirements.txt`)

| Librería | Versión | Licencia |
| --- | --- | --- |
| Ultralytics | 8.4.170 | AGPL-3.0 |
| PyTorch | 2.14.1 | BSD-3-Clause (y otras permisivas) |
| torchvision | 0.29.1 | BSD-3-Clause |
| OpenCV (opencv-python) | 4.14.0.94 | Apache 2.0 |
| Pillow | 12.3.0 | MIT-CMU |
| pandas | 3.0.6 | BSD-3-Clause |
| Matplotlib | 3.11.2 | Licencia de Matplotlib (tipo PSF) |
| scikit-learn | 1.9.1 | BSD-3-Clause |
| ImageHash | 4.3.2 | BSD-2-Clause |
