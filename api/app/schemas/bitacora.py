from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.lote import Destino, EstadoLote, Grado


class LoteBitacora(BaseModel):
    """Una fila de la vista `bitacora_lotes` (lote + su análisis más reciente).
    Sin análisis, las columnas del análisis vienen en null."""

    id: UUID
    usuario_id: UUID
    nombre: str
    fruta_principal: str | None
    parcela: str | None
    zona_id: int | None
    zona_nombre: str | None
    latitud: float | None
    longitud: float | None
    fecha_cosecha: date | None
    destino_buscado: Destino | None
    estado: EstadoLote
    created_at: datetime
    updated_at: datetime
    analisis_id: UUID | None
    analizado_at: datetime | None
    total_frutos: int | None
    frutos_sanos: int | None
    frutos_separar: int | None
    frutos_revision: int | None
    pct_sanos: float | None
    pct_separar: float | None
    conteo_por_clase: dict[str, dict[str, int]] | None
    grado: Grado | None
    destino_lote: Destino | None
    muestra_pequena: bool | None
    modelo_version: str | None
    frutos_por_destino: dict[Destino, int] | None = Field(
        description="Frutos del lote por destino (todos los destinos, con 0 si no hay); null si el lote aún no tiene frutos"
    )


class PaginaBitacora(BaseModel):
    total: int = Field(description="Lotes que cumplen los filtros, contando todas las páginas")
    limite: int
    desplazamiento: int
    lotes: list[LoteBitacora]
