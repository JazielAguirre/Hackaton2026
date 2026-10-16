import io
from dataclasses import dataclass

from PIL import Image, ImageOps

MAX_BYTES = 10 * 1024 * 1024  # mismo límite que el bucket fotos-lotes
MAX_PIXELES = 50_000_000  # evita imágenes enormes que agoten la memoria al abrirlas
LADO_MAXIMO = 1600  # suficiente para el detector y ligero de subir desde el campo
CALIDAD_JPEG = 85


class ImagenInvalida(ValueError):
    pass


@dataclass(frozen=True)
class ImagenPreparada:
    contenido: bytes
    ancho: int
    alto: int


def preparar_imagen(datos: bytes, nombre: str) -> ImagenPreparada:
    """Valida la foto y la normaliza a JPEG: orientación correcta, RGB, lado mayor
    de hasta LADO_MAXIMO px y sin metadatos EXIF (así no se guarda la ubicación GPS)."""
    if not datos:
        raise ImagenInvalida(f"«{nombre}» está vacío")
    if len(datos) > MAX_BYTES:
        raise ImagenInvalida(f"«{nombre}» pesa más de 10 MB")

    no_legible = ImagenInvalida(f"«{nombre}» no es una imagen que podamos leer (usa JPG, PNG o WebP)")
    try:
        imagen = Image.open(io.BytesIO(datos))
        ancho, alto = imagen.size
    except Exception as error:  # Pillow lanza distintos tipos de error con archivos dañados
        raise no_legible from error

    if ancho * alto > MAX_PIXELES:
        raise ImagenInvalida(f"«{nombre}» tiene una resolución demasiado grande")

    try:
        imagen.load()
        imagen = ImageOps.exif_transpose(imagen).convert("RGB")
    except Exception as error:
        raise no_legible from error

    imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
    salida = io.BytesIO()
    imagen.save(salida, format="JPEG", quality=CALIDAD_JPEG, optimize=True)
    return ImagenPreparada(contenido=salida.getvalue(), ancho=imagen.width, alto=imagen.height)
