from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class Foto(BaseModel):
    id: UUID
    lote_id: UUID
    storage_path: str
    ancho: int | None
    alto: int | None
    valida: bool
    motivo_rechazo: str | None
    created_at: datetime


class FotoDetalle(Foto):
    url: str | None = Field(description="URL firmada de la foto original; vence en 1 hora")
    url_marcada: str | None = Field(None, description="Foto con los frutos marcados, cuando exista")
