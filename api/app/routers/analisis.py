from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

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
    La web consulta `GET /lotes/{id}` hasta que el estado sea `analizado` o `error`."""
    lote = obtener_lote(bd, lote_id)
    if lote["estado"] == "analizando":
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya se está analizando")
    if lote["estado"] == "analizado":
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya fue analizado; por ahora no se puede analizar de nuevo")

    validas = bd.table("fotos").select("id").eq("lote_id", str(lote_id)).eq("valida", True).limit(1).execute().data
    if not validas:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El lote no tiene fotos válidas para analizar")

    # Pasa a `analizando` solo si sigue en borrador o error: dos clics seguidos no lanzan dos análisis.
    # El usuario ya está verificado arriba; el cambio de estado lo hace la API, no la web.
    reclamado = (
        admin.table("lotes").update({"estado": "analizando"}).eq("id", str(lote_id))
        .in_("estado", ["borrador", "error"]).execute().data
    )
    if not reclamado:
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote ya se está analizando")

    tareas.add_task(analizar_lote, admin, inferencia, lote_id)
    return reclamado[0]
