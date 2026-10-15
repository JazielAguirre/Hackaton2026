import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from postgrest import APIError
from storage3.utils import StorageException

from app.deps import SESION_INVALIDA

logger = logging.getLogger(__name__)

# Códigos de PostgREST para un JWT inválido o vencido.
ERRORES_JWT = {"PGRST301", "PGRST303"}


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    def error_base_de_datos(_: Request, error: APIError) -> JSONResponse:
        if error.code in ERRORES_JWT:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": SESION_INVALIDA},
            )
        # El detalle va al log, nunca al cliente.
        logger.error("Error de PostgREST %s: %s", error.code, error.message)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"detail": "Error al consultar la base de datos; intenta de nuevo"},
        )

    @app.exception_handler(StorageException)
    def error_storage(_: Request, error: StorageException) -> JSONResponse:
        logger.error("Error de Storage: %s", error)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"detail": "Error al guardar o leer las fotos; intenta de nuevo"},
        )
