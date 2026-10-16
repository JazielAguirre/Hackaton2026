import logging
from collections import Counter
from typing import Any
from uuid import UUID, uuid4

from supabase import Client

from app.services.inferencia import ClienteInferencia, FrutoDetectado
from app.services.storage import BUCKET

logger = logging.getLogger(__name__)


def analizar_lote(admin: Client, inferencia: ClienteInferencia, lote_id: UUID) -> None:
    """Tarea en segundo plano de `POST /lotes/{id}/analizar`.

    Corre el modelo en cada foto, guarda los frutos y cierra el análisis. El destino de cada
    fruto lo asigna el trigger de la base y el grado lo calcula `cerrar_analisis_lote()`;
    aquí no se repite esa lógica. Si algo falla, el lote queda en `error` sin frutos de esta corrida.
    """
    ids_guardados: list[str] = []
    try:
        # Es seguro borrar: solo se llega aquí desde borrador, error o analizando vencido, y en ninguno hubo
        # un análisis completo (un lote `analizado` nunca se reanaliza). Lo que haya son restos de una corrida cortada.
        admin.table("frutos").delete().eq("lote_id", str(lote_id)).execute()

        fotos = (
            admin.table("fotos").select("id,storage_path").eq("lote_id", str(lote_id)).eq("valida", True)
            .order("created_at").execute().data
        )
        if not fotos:
            raise ValueError("El lote no tiene fotos válidas")

        # La fruta del lote (si ya la tiene) manda sobre la del detector; la web no la pide, así que cada caja usa la que dio el detector.
        lote = admin.table("lotes").select("fruta_principal").eq("id", str(lote_id)).limit(1).execute().data
        fruta = lote[0]["fruta_principal"] if lote else None

        clases = _ids_de_clases(admin)
        archivos = admin.storage.from_(BUCKET)

        # Primero se procesan todas las fotos y solo después se guarda: si una falla no queda nada a medias.
        filas: list[dict[str, Any]] = []
        version = ""
        for foto in fotos:
            resultado = inferencia.inferir(archivos.download(foto["storage_path"]), fruta)
            version = resultado.modelo_version
            filas += [f for f in (_fila_fruto(lote_id, foto["id"], d, clases) for d in resultado.frutos) if f]

        if filas:
            # Un solo insert: o se guardan todos los frutos o ninguno.
            admin.table("frutos").insert(filas).execute()
            ids_guardados = [f["id"] for f in filas]
            _completar_fruta_principal(admin, lote_id, filas)

        admin.rpc("cerrar_analisis_lote", {"p_lote_id": str(lote_id), "p_modelo_version": version}).execute()
    except Exception:
        logger.exception("Falló el análisis del lote %s", lote_id)
        _marcar_error(admin, lote_id, ids_guardados)


def _ids_de_clases(admin: Client) -> dict[tuple[str, str], int]:
    """(fruta, código de clase en la BD) -> clases.id"""
    filas = admin.table("clases").select("id,fruta_id,codigo").execute().data
    return {(c["fruta_id"], c["codigo"]): c["id"] for c in filas}


def _fila_fruto(
    lote_id: UUID, foto_id: str, d: FrutoDetectado, clases: dict[tuple[str, str], int]
) -> dict[str, Any] | None:
    if d.caja_ancho <= 0 or d.caja_alto <= 0:
        logger.warning("Se descartó una caja vacía en la foto %s", foto_id)
        return None
    clase_id = clases.get((d.fruta, d.clase_bd)) if d.clase_bd else None
    if d.clase_bd and clase_id is None:
        # Sin clase, la base manda el fruto a revisión manual.
        logger.warning("La clase %s de %s no existe en la tabla clases", d.clase_bd, d.fruta)
    return {
        "id": str(uuid4()),
        "foto_id": foto_id,
        "lote_id": str(lote_id),
        "fruta_id": d.fruta,
        "caja_x": d.caja_x,
        "caja_y": d.caja_y,
        "caja_ancho": d.caja_ancho,
        "caja_alto": d.caja_alto,
        "conf_deteccion": d.conf_deteccion,
        "clase_id": clase_id,
        "conf_clasificacion": d.conf_clasificacion if clase_id is not None else None,
    }


def _completar_fruta_principal(admin: Client, lote_id: UUID, filas: list[dict[str, Any]]) -> None:
    """El productor no elige la fruta: el lote toma la que más detectó el modelo."""
    lote = admin.table("lotes").select("fruta_principal").eq("id", str(lote_id)).limit(1).execute().data
    if lote and lote[0]["fruta_principal"] is None:
        fruta = Counter(f["fruta_id"] for f in filas).most_common(1)[0][0]
        admin.table("lotes").update({"fruta_principal": fruta}).eq("id", str(lote_id)).execute()


def _marcar_error(admin: Client, lote_id: UUID, ids_guardados: list[str]) -> None:
    # Solo se borran los frutos que guardó esta corrida (si se llegó a guardarlos).
    try:
        for i in range(0, len(ids_guardados), 100):
            admin.table("frutos").delete().in_("id", ids_guardados[i : i + 100]).execute()
    except Exception:
        logger.exception("No se pudieron borrar los frutos de la corrida fallida del lote %s", lote_id)
    try:
        admin.table("lotes").update({"estado": "error"}).eq("id", str(lote_id)).execute()
    except Exception:
        logger.exception("No se pudo marcar el lote %s con error", lote_id)
