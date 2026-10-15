from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Mismos valores que los enums de la base de datos.
Destino = Literal["exportacion", "mercado_nacional", "procesamiento", "separar", "revision_manual"]
EstadoLote = Literal["borrador", "analizando", "analizado", "error"]

TextoCorto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
IdFruta = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1)]


class LoteCrear(BaseModel):
    # extra="forbid": el cliente no puede elegir usuario_id ni estado.
    model_config = ConfigDict(extra="forbid")

    nombre: TextoCorto
    fruta_principal: IdFruta | None = Field(None, examples=["mango"])
    parcela: TextoCorto | None = None
    zona_id: int | None = Field(None, gt=0, description="Si no se manda, se usa la zona del perfil")
    latitud: float | None = Field(None, ge=-90, le=90)
    longitud: float | None = Field(None, ge=-180, le=180)
    fecha_cosecha: date | None = None
    destino_buscado: Destino | None = None


class Lote(BaseModel):
    id: UUID
    usuario_id: UUID
    nombre: str
    fruta_principal: str | None
    parcela: str | None
    zona_id: int | None
    latitud: float | None
    longitud: float | None
    fecha_cosecha: date | None
    destino_buscado: Destino | None
    estado: EstadoLote
    created_at: datetime
    updated_at: datetime
