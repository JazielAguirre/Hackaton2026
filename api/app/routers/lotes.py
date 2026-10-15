from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from supabase import Client

from app.deps import ClienteUsuario, UsuarioActual
from app.schemas.lote import Lote, LoteCrear

router = APIRouter(prefix="/lotes", tags=["lotes"])

FRUTA_NO_SOPORTADA = "Fruta no soportada: solo se analizan mango, jitomate y fresa"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Lote, summary="Crear un lote")
def crear_lote(datos: LoteCrear, usuario: UsuarioActual, bd: ClienteUsuario) -> dict[str, Any]:
    if datos.fruta_principal is not None and not _existe_activa(bd, "frutas", datos.fruta_principal):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, FRUTA_NO_SOPORTADA)

    zona_id = datos.zona_id
    if zona_id is None:
        zona_id = _zona_del_perfil(bd, usuario.id)
    elif not _existe_activa(bd, "zonas", zona_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La zona no existe o no está activa")

    # usuario_id y estado los pone la base de datos (default auth.uid() y 'borrador').
    fila = datos.model_dump(mode="json") | {"zona_id": zona_id}
    return bd.table("lotes").insert(fila).execute().data[0]


def _existe_activa(bd: Client, tabla: str, id_: str | int) -> bool:
    filas = bd.table(tabla).select("id").eq("id", id_).eq("activa", True).limit(1).execute().data
    return bool(filas)


def _zona_del_perfil(bd: Client, usuario_id: UUID) -> int | None:
    filas = bd.table("perfiles").select("zona_id").eq("id", str(usuario_id)).limit(1).execute().data
    return filas[0]["zona_id"] if filas else None
