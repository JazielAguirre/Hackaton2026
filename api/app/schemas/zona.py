import unicodedata
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
TextoOpcional = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


def clave_nombre(nombre: str) -> str:
    """Sin acentos ni mayúsculas: 'Zona Sur' y 'zona sur' cuentan como la misma zona."""
    sin_acentos = unicodedata.normalize("NFD", nombre)
    return "".join(c for c in sin_acentos if not unicodedata.combining(c)).casefold().strip()


class ZonaCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: Nombre
    municipio: TextoOpcional | None = None
    estado: TextoOpcional | None = None
    latitud: float | None = Field(None, ge=-90, le=90)
    longitud: float | None = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def coordenadas_juntas(self) -> Self:
        # Una sola coordenada no sirve para ubicar la zona.
        if (self.latitud is None) != (self.longitud is None):
            raise ValueError("Manda latitud y longitud juntas, o ninguna de las dos")
        return self


class Zona(BaseModel):
    id: int
    nombre: str
    municipio: str | None
    estado: str | None
    latitud: float | None
    longitud: float | None
    activa: bool
