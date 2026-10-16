from functools import lru_cache

import httpx
from pydantic import BaseModel

from app.config import get_settings

# Una foto con muchos frutos tarda décimas de segundo; el margen cubre un arranque en frío.
TIMEOUT_SEGUNDOS = 60


class InferenciaError(Exception):
    """El servicio de inferencia no respondió o respondió algo inválido."""


class FrutoDetectado(BaseModel):
    fruta: str
    caja_x: float
    caja_y: float
    caja_ancho: float
    caja_alto: float
    conf_deteccion: float
    # Sin clasificador para esa fruta, estos dos vienen null.
    clase_bd: str | None
    # Probabilidad top-1 de la clase del modelo, antes de agrupar clases en la BD.
    conf_clasificacion: float | None


class ResultadoInferencia(BaseModel):
    frutos: list[FrutoDetectado]
    modelo_version: str


class ClienteInferencia:
    """Llama al servicio de `inferencia/` (docker-compose.yml)."""

    def __init__(self, url: str) -> None:
        self.url = url.rstrip("/")

    def inferir(self, imagen: bytes, fruta: str | None = None) -> ResultadoInferencia:
        """Con `fruta` (la del lote) el servicio toma todas las cajas como esa fruta."""
        try:
            respuesta = httpx.post(
                f"{self.url}/inferir",
                files={"foto": ("foto.jpg", imagen, "image/jpeg")},
                data={"fruta": fruta} if fruta else None,
                timeout=TIMEOUT_SEGUNDOS,
            )
            respuesta.raise_for_status()
            return ResultadoInferencia.model_validate(respuesta.json())
        except (httpx.HTTPError, ValueError) as error:
            raise InferenciaError(f"El servicio de inferencia falló: {error}") from error


@lru_cache
def cliente_inferencia() -> ClienteInferencia:
    return ClienteInferencia(get_settings().inferencia_url)
