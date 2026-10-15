from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from supabase import Client

from app.deps import ClienteUsuario, UsuarioActual
from app.schemas.lote import Lote, LoteCrear, LoteDetalle
from app.services.lotes import obtener_lote
from app.services.storage import BUCKET

router = APIRouter(prefix="/lotes", tags=["lotes"])

FRUTA_NO_SOPORTADA = "Fruta no soportada: solo se analizan mango, jitomate y fresa"
URL_EXPIRA_SEGUNDOS = 3600


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


@router.get("/{lote_id}", response_model=LoteDetalle, summary="Detalle de un lote")
def detalle_lote(lote_id: UUID, bd: ClienteUsuario) -> dict[str, Any]:
    """Lote con sus fotos, su análisis más reciente, los frutos detectados y las
    sugerencias. Mientras no hay análisis, `analisis` es null y las listas van vacías."""
    lote = obtener_lote(bd, lote_id)
    fotos = bd.table("fotos").select("*").eq("lote_id", str(lote_id)).order("created_at").execute().data
    frutos = bd.table("frutos").select("*").eq("lote_id", str(lote_id)).order("created_at").execute().data
    analisis = _ultimo_analisis(bd, lote_id)
    sugerencias = []
    if analisis is not None:
        sugerencias = (
            bd.table("sugerencias").select("*").eq("analisis_id", analisis["id"]).order("created_at").execute().data
        )

    return lote | {
        "zona_nombre": _nombre_zona(bd, lote["zona_id"]),
        "fotos": _con_urls_firmadas(bd, fotos),
        "analisis": analisis,
        "frutos": _con_clase(bd, frutos),
        "sugerencias": sugerencias,
    }


def _ultimo_analisis(bd: Client, lote_id: UUID) -> dict[str, Any] | None:
    filas = (
        bd.table("analisis_lote").select("*").eq("lote_id", str(lote_id))
        .order("created_at", desc=True).limit(1).execute().data
    )
    return filas[0] if filas else None


def _nombre_zona(bd: Client, zona_id: int | None) -> str | None:
    if zona_id is None:
        return None
    filas = bd.table("zonas").select("nombre").eq("id", zona_id).limit(1).execute().data
    return filas[0]["nombre"] if filas else None


def _con_urls_firmadas(bd: Client, fotos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # El bucket es privado: la web solo puede ver las fotos con una URL firmada.
    if not fotos:
        return []
    firmadas = bd.storage.from_(BUCKET).create_signed_urls(
        [f["storage_path"] for f in fotos], URL_EXPIRA_SEGUNDOS
    )
    url_por_ruta = {f["path"]: f["signedURL"] for f in firmadas if not f.get("error")}
    return [f | {"url": url_por_ruta.get(f["storage_path"]), "url_marcada": None} for f in fotos]


def _con_clase(bd: Client, frutos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not frutos:
        return []
    clases = {
        c["id"]: {"codigo": c["codigo"], "nombre": c["nombre"]}
        for c in bd.table("clases").select("id,codigo,nombre").execute().data
    }
    return [f | {"clase": clases.get(f["clase_id"])} for f in frutos]
