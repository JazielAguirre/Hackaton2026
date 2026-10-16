from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from supabase import Client

from app.deps import ClienteUsuario, UsuarioActual
from app.schemas.lote import Lote, LoteCrear, LoteDetalle
from app.services.lotes import frutos_con_clase, nombre_zona, obtener_lote, ultimo_analisis
from app.services.storage import BUCKET

router = APIRouter(prefix="/lotes", tags=["lotes"])

FRUTA_NO_SOPORTADA = "Fruta no soportada: solo se analizan mango, jitomate y fresa"
FALTA_PARCELA = "Elige la parcela del lote"
URL_EXPIRA_SEGUNDOS = 3600


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Lote, summary="Crear un lote")
def crear_lote(datos: LoteCrear, usuario: UsuarioActual, bd: ClienteUsuario) -> dict[str, Any]:
    if datos.fruta_principal is not None and not _existe_activa(bd, "frutas", datos.fruta_principal):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, FRUTA_NO_SOPORTADA)

    # Cada lote pertenece a una parcela. La base la deja opcional por los lotes viejos.
    if datos.parcela_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, FALTA_PARCELA)
    parcela = _parcela_activa(bd, datos.parcela_id)

    zona_id = datos.zona_id
    if zona_id is None:
        # Si la parcela tiene zona, el lote debe usar esa (la base rechaza otra).
        zona_id = parcela["zona_id"] if parcela and parcela["zona_id"] else _zona_del_perfil(bd, usuario.id)
    elif not _existe_activa(bd, "zonas", zona_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La zona no existe o no está activa")

    # usuario_id y estado los pone la base de datos (default auth.uid() y 'borrador').
    fila = datos.model_dump(mode="json") | {"zona_id": zona_id}
    if datos.parcela is None:
        fila["parcela"] = parcela["nombre"]
    return bd.table("lotes").insert(fila).execute().data[0]


def _parcela_activa(bd: Client, parcela_id: UUID) -> dict[str, Any]:
    # RLS solo deja ver las parcelas del usuario: una ajena se ve igual que una que no existe.
    filas = (
        bd.table("parcelas").select("id,nombre,zona_id").eq("id", str(parcela_id)).eq("activa", True)
        .limit(1).execute().data
    )
    if not filas:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La parcela no existe o no está activa")
    return filas[0]


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
    analisis = ultimo_analisis(bd, lote_id)
    sugerencias = []
    if analisis is not None:
        sugerencias = (
            bd.table("sugerencias").select("*").eq("analisis_id", analisis["id"]).order("created_at").execute().data
        )

    return lote | {
        "zona_nombre": nombre_zona(bd, lote["zona_id"]),
        "fotos": _con_urls_firmadas(bd, fotos),
        "analisis": analisis,
        "frutos": frutos_con_clase(bd, lote_id),
        "sugerencias": sugerencias,
    }


def _con_urls_firmadas(bd: Client, fotos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # El bucket es privado: la web solo puede ver las fotos con una URL firmada.
    if not fotos:
        return []
    firmadas = bd.storage.from_(BUCKET).create_signed_urls(
        [f["storage_path"] for f in fotos], URL_EXPIRA_SEGUNDOS
    )
    url_por_ruta = {f["path"]: f["signedURL"] for f in firmadas if not f.get("error")}
    return [f | {"url": url_por_ruta.get(f["storage_path"]), "url_marcada": None} for f in fotos]
