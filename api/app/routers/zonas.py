from typing import Any

from fastapi import APIRouter, HTTPException, status
from postgrest import APIError

from app.deps import ClienteAdmin, ClienteUsuario, UsuarioActual
from app.schemas.zona import Zona, ZonaCrear, clave_nombre

router = APIRouter(prefix="/zonas", tags=["zonas"])

ROLES_QUE_REGISTRAN = {"acopio", "tecnico"}
NOMBRE_REPETIDO = "Ya existe una zona con ese nombre"
UNIQUE_VIOLATION = "23505"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Zona, summary="Registrar una zona")
def crear_zona(datos: ZonaCrear, usuario: UsuarioActual, bd: ClienteUsuario, admin: ClienteAdmin) -> dict[str, Any]:
    """Solo el centro de acopio o un técnico registran zonas; los productores solo las consultan."""
    # El rol sale de `perfiles` (RLS: cada quien ve el suyo), nunca del token.
    perfil = bd.table("perfiles").select("rol").eq("id", str(usuario.id)).limit(1).execute().data
    if not perfil or perfil[0]["rol"] not in ROLES_QUE_REGISTRAN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Solo el centro de acopio o un técnico pueden registrar zonas"
        )

    clave = clave_nombre(datos.nombre)
    if any(clave_nombre(z["nombre"]) == clave for z in admin.table("zonas").select("nombre").execute().data):
        raise HTTPException(status.HTTP_409_CONFLICT, NOMBRE_REPETIDO)

    try:
        return admin.table("zonas").insert(datos.model_dump()).execute().data[0]
    except APIError as error:
        # Otra petición pudo registrar el mismo nombre entre la revisión y el insert.
        if error.code == UNIQUE_VIOLATION:
            raise HTTPException(status.HTTP_409_CONFLICT, NOMBRE_REPETIDO) from error
        raise
