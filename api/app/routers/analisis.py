from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.config import get_settings
from app.deps import ClienteAdmin, ClienteUsuario
from app.schemas.lote import Lote
from app.services.analisis import analizar_lote
from app.services.inferencia import ClienteInferencia, cliente_inferencia
from app.services.lotes import obtener_lote

router = APIRouter(tags=["análisis"])


@router.post(
    "/lotes/{lote_id}/analizar",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=Lote,
    summary="Analizar las fotos de un lote",
)
def analizar(
    lote_id: UUID,
    tareas: BackgroundTasks,
    bd: ClienteUsuario,
    admin: ClienteAdmin,
    inferencia: Annotated[ClienteInferencia, Depends(cliente_inferencia)],
) -> dict[str, Any]:
    """Responde de inmediato con el lote en `analizando`; el análisis sigue en segundo plano.
    La web consulta `GET /lotes/{id}` hasta que el estado sea `analizado` o `error`.

    Se puede reintentar un lote en `error` o en `analizando` desde hace más de
    `ANALISIS_VENCIDO_MINUTOS` (la API se cayó a la mitad y nadie lo pasó a `error`)."""
    lote = obtener_lote(bd, lote_id)
    corte = datetime.now(timezone.utc) - timedelta(minutes=get_settings().analisis_vencido_minutos)
    if lote["estado"] == "analizado":
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya fue analizado; por ahora no se puede analizar de nuevo")
    if lote["estado"] == "analizando" and datetime.fromisoformat(lote["updated_at"]) >= corte:
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya se está analizando")

    validas = bd.table("fotos").select("id").eq("lote_id", str(lote_id)).eq("valida", True).limit(1).execute().data
    if not validas:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El lote no tiene fotos válidas para analizar")

    # Pasa a `analizando` con un solo update condicionado al estado que se acaba de leer: si dos clics
    # llegan juntos, solo uno modifica la fila y el otro recibe 0 filas. En el caso vencido la condición
    # incluye `updated_at`; el trigger de la base la renueva al reclamar, así que el segundo ya no cumple.
    # El usuario ya está verificado arriba; el cambio de estado lo hace la API, no la web.
    reclamo = admin.table("lotes").update({"estado": "analizando"}).eq("id", str(lote_id))
    if lote["estado"] == "analizando":
        reclamo = reclamo.eq("estado", "analizando").lt("updated_at", corte.isoformat())
    else:
        reclamo = reclamo.in_("estado", ["borrador", "error"])
    reclamado = reclamo.execute().data
    if not reclamado:
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya se está analizando")

    tareas.add_task(analizar_lote, admin, inferencia, lote_id)
    return reclamado[0]
