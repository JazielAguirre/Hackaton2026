from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client


def obtener_lote(bd: Client, lote_id: UUID) -> dict[str, Any]:
    """Devuelve el lote si es del usuario. Con el cliente del usuario, RLS oculta
    los lotes ajenos, así que uno ajeno y uno inexistente dan el mismo 404."""
    filas = bd.table("lotes").select("*").eq("id", str(lote_id)).limit(1).execute().data
    if not filas:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lote no encontrado")
    return filas[0]


def ultimo_analisis(bd: Client, lote_id: UUID) -> dict[str, Any] | None:
    filas = (
        bd.table("analisis_lote").select("*").eq("lote_id", str(lote_id))
        .order("created_at", desc=True).limit(1).execute().data
    )
    return filas[0] if filas else None


def nombre_zona(bd: Client, zona_id: int | None) -> str | None:
    if zona_id is None:
        return None
    filas = bd.table("zonas").select("nombre").eq("id", zona_id).limit(1).execute().data
    return filas[0]["nombre"] if filas else None


def frutos_con_clase(bd: Client, lote_id: UUID) -> list[dict[str, Any]]:
    """Frutos del lote, cada uno con el código y el nombre de su clase."""
    frutos = bd.table("frutos").select("*").eq("lote_id", str(lote_id)).order("created_at").execute().data
    if not frutos:
        return []
    clases = {
        c["id"]: {"codigo": c["codigo"], "nombre": c["nombre"]}
        for c in bd.table("clases").select("id,codigo,nombre").execute().data
    }
    return [f | {"clase": clases.get(f["clase_id"])} for f in frutos]
