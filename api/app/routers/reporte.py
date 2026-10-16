from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.deps import ClienteUsuario
from app.services.lotes import frutos_con_clase, nombre_zona, obtener_lote, ultimo_analisis
from app.services.reporte_pdf import generar_reporte

router = APIRouter(tags=["reporte"])


@router.get(
    "/lotes/{lote_id}/reporte.pdf",
    summary="Reporte PDF de un lote analizado",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def reporte_pdf(lote_id: UUID, bd: ClienteUsuario) -> Response:
    lote = obtener_lote(bd, lote_id)
    analisis = ultimo_analisis(bd, lote_id) if lote["estado"] == "analizado" else None
    if analisis is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "El lote todavía no está analizado; no hay reporte que descargar")

    sugerencias = (
        bd.table("sugerencias").select("*").eq("analisis_id", analisis["id"]).order("created_at").execute().data
    )
    pdf = generar_reporte(
        lote, analisis, frutos_con_clase(bd, lote_id), sugerencias, nombre_zona(bd, lote["zona_id"])
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="reporte-lote-{str(lote_id)[:8]}.pdf"'},
    )
