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
