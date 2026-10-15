from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class Foto(BaseModel):
    id: UUID
    lote_id: UUID
    storage_path: str
    ancho: int | None
    alto: int | None
    valida: bool
    motivo_rechazo: str | None
    created_at: datetime
