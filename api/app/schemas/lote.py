from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.foto import FotoDetalle

# Mismos valores que los enums de la base de datos.
Destino = Literal["exportacion", "mercado_nacional", "procesamiento", "separar", "revision_manual"]
EstadoLote = Literal["borrador", "analizando", "analizado", "error"]
Grado = Literal["A", "B", "C", "rechazo"]
OrigenSugerencia = Literal["plantilla", "llm"]

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


class ClaseResumen(BaseModel):
    codigo: str
    nombre: str


class Fruto(BaseModel):
    id: UUID
    foto_id: UUID
    fruta_id: str
    conf_deteccion: float
    # Caja normalizada de 0 a 1 respecto al tamaño de la foto.
    caja_x: float
    caja_y: float
    caja_ancho: float
    caja_alto: float
    clase: ClaseResumen | None
    conf_clasificacion: float | None
    destino: Destino
    requiere_revision: bool


class Analisis(BaseModel):
    id: UUID
    total_frutos: int
    frutos_sanos: int
    frutos_separar: int
    frutos_revision: int
    pct_sanos: float | None
    pct_separar: float | None
    conteo_por_clase: dict[str, dict[str, int]]
    grado: Grado | None
    destino_lote: Destino | None
    muestra_pequena: bool
    modelo_version: str | None
    created_at: datetime


class Sugerencia(BaseModel):
    id: UUID
    ficha_id: int | None
    texto: str
    origen: OrigenSugerencia
    created_at: datetime


class LoteDetalle(Lote):
    zona_nombre: str | None
    fotos: list[FotoDetalle]
    analisis: Analisis | None = Field(description="Análisis más reciente; null si aún no se analiza")
    frutos: list[Fruto]
    sugerencias: list[Sugerencia] = Field(description="Sugerencias del análisis más reciente")
