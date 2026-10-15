from uuid import UUID

BUCKET = "fotos-lotes"


def ruta_foto(usuario_id: UUID, lote_id: UUID, foto_id: UUID) -> str:
    """Ruta dentro del bucket. La carpeta del usuario va primero porque así lo
    exigen las políticas de Storage."""
    return f"{usuario_id}/{lote_id}/{foto_id}.jpg"
