from collections import Counter
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query
from supabase import Client

from app.deps import ClienteUsuario
from app.schemas.bitacora import PaginaBitacora
from app.schemas.lote import Grado

router = APIRouter(tags=["bitácora"])

DESTINOS: tuple[str, ...] = ("exportacion", "mercado_nacional", "procesamiento", "separar", "revision_manual")
# PostgREST responde como máximo 1000 filas por consulta.
FILAS_POR_CONSULTA = 1000


@router.get("/bitacora", response_model=PaginaBitacora, summary="Bitácora de lotes del usuario")
def bitacora(
    bd: ClienteUsuario,
    fruta: Annotated[str | None, Query(description="Código de la fruta, p. ej. mango")] = None,
    grado: Annotated[Grado | None, Query()] = None,
    zona_id: Annotated[int | None, Query(gt=0)] = None,
    parcela_id: Annotated[UUID | None, Query(description="Solo los lotes de esta parcela")] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    desplazamiento: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, Any]:
    """Lotes del usuario (RLS) con su análisis más reciente, del más nuevo al más antiguo."""
    consulta = bd.table("bitacora_lotes").select("*", count="exact")
    if fruta:
        consulta = consulta.eq("fruta_principal", fruta.strip().lower())
    if grado:
        consulta = consulta.eq("grado", grado)
    if zona_id:
        consulta = consulta.eq("zona_id", zona_id)
    if parcela_id:
        # La vista no trae parcela_id: se buscan los lotes de la parcela y se filtra la vista por sus ids.
        ids = _lotes_de_parcela(bd, parcela_id)
        if not ids:
            return {"total": 0, "limite": limite, "desplazamiento": desplazamiento, "lotes": []}
        consulta = consulta.in_("id", ids)
    respuesta = (
        consulta.order("created_at", desc=True).range(desplazamiento, desplazamiento + limite - 1).execute()
    )

    lotes = respuesta.data
    ids_pagina = [lote["id"] for lote in lotes]
    parcelas = _parcela_de_lotes(bd, ids_pagina)
    por_destino = _frutos_por_destino(bd, ids_pagina)
    return {
        "total": respuesta.count or 0,
        "limite": limite,
        "desplazamiento": desplazamiento,
        "lotes": [
            lote | {"parcela_id": parcelas.get(lote["id"]), "frutos_por_destino": por_destino.get(lote["id"])}
            for lote in lotes
        ],
    }


def _lotes_de_parcela(bd: Client, parcela_id: UUID) -> list[str]:
    filas = bd.table("lotes").select("id").eq("parcela_id", str(parcela_id)).limit(FILAS_POR_CONSULTA).execute().data
    return [fila["id"] for fila in filas]


def _parcela_de_lotes(bd: Client, lote_ids: list[str]) -> dict[str, str | None]:
    if not lote_ids:
        return {}
    filas = bd.table("lotes").select("id,parcela_id").in_("id", lote_ids).execute().data
    return {fila["id"]: fila["parcela_id"] for fila in filas}


def _frutos_por_destino(bd: Client, lote_ids: list[str]) -> dict[str, dict[str, int]]:
    """Cuenta los frutos de cada lote por destino. Solo suma lo que ya asignó la base de datos."""
    if not lote_ids:
        return {}
    conteo: dict[str, Counter[str]] = {}
    desde = 0
    while True:
        filas = (
            bd.table("frutos").select("lote_id,destino").in_("lote_id", lote_ids)
            .order("id").range(desde, desde + FILAS_POR_CONSULTA - 1).execute().data
        )
        for fila in filas:
            conteo.setdefault(fila["lote_id"], Counter())[fila["destino"]] += 1
        if len(filas) < FILAS_POR_CONSULTA:
            break
        desde += FILAS_POR_CONSULTA
    return {lote_id: {d: contador[d] for d in DESTINOS} for lote_id, contador in conteo.items()}
