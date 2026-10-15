# FruitScan

Control de calidad visual de fruta por lote: el productor toma o sube fotos, el sistema detecta cada fruto, lo clasifica, le asigna un destino y le da un grado al lote. Es una preclasificación visual, no una certificación de exportación.

Proyecto del Hackatón LSC 2026, equipo Los Claudios.

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
