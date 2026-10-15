import logging
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.deps import ClienteUsuario, UsuarioActual
from app.schemas.foto import Foto
from app.services.imagenes import MAX_BYTES, ImagenInvalida, preparar_imagen
from app.services.lotes import obtener_lote
from app.services.storage import BUCKET, ruta_foto

logger = logging.getLogger(__name__)

router = APIRouter(tags=["fotos"])

MAX_FOTOS_POR_PETICION = 20


@router.post(
    "/lotes/{lote_id}/fotos",
    status_code=status.HTTP_201_CREATED,
    response_model=list[Foto],
    summary="Subir fotos a un lote",
)
def subir_fotos(
    lote_id: UUID,
    fotos: Annotated[list[UploadFile], File(description="Una o más fotos del lote")],
    usuario: UsuarioActual,
    bd: ClienteUsuario,
) -> list[dict[str, Any]]:
    lote = obtener_lote(bd, lote_id)
    if lote["estado"] == "analizando":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El lote se está analizando; espera a que termine para subir más fotos",
        )
    if len(fotos) > MAX_FOTOS_POR_PETICION:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Sube máximo {MAX_FOTOS_POR_PETICION} fotos a la vez",
        )

    # Se validan todas antes de subir nada: si una falla, no se guarda ninguna.
    try:
        imagenes = [preparar_imagen(f.file.read(MAX_BYTES + 1), f.filename or "foto") for f in fotos]
    except ImagenInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    nuevas = []
    for imagen in imagenes:
        foto_id = uuid4()
        nuevas.append({
            "id": str(foto_id),
            "lote_id": str(lote_id),
            "storage_path": ruta_foto(usuario.id, lote_id, foto_id),
            "ancho": imagen.ancho,
            "alto": imagen.alto,
        })

    archivos = bd.storage.from_(BUCKET)
    subidas: list[str] = []
    try:
        for fila, imagen in zip(nuevas, imagenes):
            archivos.upload(fila["storage_path"], imagen.contenido, {"content-type": "image/jpeg"})
            subidas.append(fila["storage_path"])
        # Un solo insert: o se registran todas las fotos o ninguna.
        return bd.table("fotos").insert(nuevas).execute().data
    except Exception:
        _borrar_archivos(archivos, subidas)
        raise


def _borrar_archivos(archivos: Any, rutas: list[str]) -> None:
    """Quita lo que alcanzó a subirse para no dejar archivos sin fila en `fotos`."""
    if not rutas:
        return
    try:
        archivos.remove(rutas)
    except Exception:
        logger.exception("No se pudieron borrar las fotos subidas: %s", rutas)
