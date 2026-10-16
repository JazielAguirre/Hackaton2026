from datetime import datetime, timedelta, timezone

from app.services.inferencia import InferenciaError
from tests.conftest import OTRO_USUARIO_ID, USUARIO, agregar, detectado


def _lote(bd, estado="borrador", usuario_id=USUARIO.id, fotos=2, **extra) -> str:
    """Lote con `fotos` fotos válidas ya subidas a Storage."""
    lote = agregar(bd, "lotes", nombre="Lote", usuario_id=str(usuario_id), estado=estado, **extra)
    for i in range(fotos):
        ruta = f"{usuario_id}/{lote['id']}/{i}.jpg"
        agregar(bd, "fotos", lote_id=lote["id"], storage_path=ruta, created_at=f"2026-10-16T10:0{i}:00+00:00")
        bd.storage.objetos[ruta] = (f"imagen-{i}".encode(), {})
    return lote["id"]


def _hace(minutos: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()


def _estado(bd, lote_id) -> str:
    return next(l for l in bd.tablas["lotes"] if l["id"] == lote_id)["estado"]


def test_analiza_el_lote_y_guarda_los_frutos(cliente, bd, admin, inferencia):
    lote_id = _lote(bd)
    inferencia.por_foto = [
        [detectado(clase_bd="sano", conf=0.93, x=0.1, y=0.2, ancho=0.3, alto=0.25), detectado(clase_bd="otro_defecto", conf=0.51)],
        [detectado(clase_bd="antracnosis", conf=0.77)],
    ]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 202
    assert respuesta.json()["estado"] == "analizando"
    assert inferencia.imagenes == [b"imagen-0", b"imagen-1"]
    frutos = bd.tablas["frutos"]
    assert len(frutos) == 3
    primero = frutos[0]
    assert primero["lote_id"] == lote_id
    assert primero["fruta_id"] == "mango"
    assert (primero["caja_x"], primero["caja_y"], primero["caja_ancho"], primero["caja_alto"]) == (0.1, 0.2, 0.3, 0.25)
    assert primero["conf_deteccion"] == 0.88
    assert [f["clase_id"] for f in frutos] == [1, 3, 2]
    assert [f["conf_clasificacion"] for f in frutos] == [0.93, 0.51, 0.77]
    # Cada fruto queda ligado a la foto de la que salió.
    fotos = {f["storage_path"][-5]: f["id"] for f in bd.tablas["fotos"]}
    assert [f["foto_id"] for f in frutos] == [fotos["0"], fotos["0"], fotos["1"]]
    assert admin.rpc_llamadas == [("cerrar_analisis_lote", {"p_lote_id": lote_id, "p_modelo_version": "prueba123"})]
    assert _estado(bd, lote_id) == "analizado"


def test_no_calcula_el_destino_en_python(cliente, bd, admin, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    (tabla, filas), = [i for i in admin.inserciones if i[0] == "frutos"]
    assert "destino" not in filas[0] and "requiere_revision" not in filas[0]


def test_el_lote_toma_la_fruta_que_mas_detecto(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado(), detectado(), detectado("fresa", clase_bd=None)]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert next(l for l in bd.tablas["lotes"] if l["id"] == lote_id)["fruta_principal"] == "mango"


def test_no_cambia_la_fruta_que_ya_tenia_el_lote(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1, fruta_principal="fresa")
    inferencia.por_foto = [[detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert next(l for l in bd.tablas["lotes"] if l["id"] == lote_id)["fruta_principal"] == "fresa"


def test_fruta_sin_clasificador_queda_sin_clase(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado("jitomate", clase_bd=None)]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    fruto = bd.tablas["frutos"][0]
    assert fruto["fruta_id"] == "jitomate"
    assert fruto["clase_id"] is None and fruto["conf_clasificacion"] is None


def test_lote_de_fresa_manda_la_fruta_y_guarda_frutos_de_fresa(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=2, fruta_principal="fresa")
    inferencia.por_foto = [[detectado("fresa", clase_bd="moho_gris", conf=0.8)], [detectado("fresa", clase_bd="sana")]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert inferencia.frutas == ["fresa", "fresa"]
    frutos = bd.tablas["frutos"]
    assert [f["fruta_id"] for f in frutos] == ["fresa", "fresa"]
    assert [f["clase_id"] for f in frutos] == [7, 6]
    assert frutos[0]["conf_clasificacion"] == 0.8


def test_lote_de_jitomate_manda_la_fruta_y_guarda_frutos_de_jitomate(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1, fruta_principal="jitomate")
    inferencia.por_foto = [[detectado("jitomate", clase_bd="pudricion_mancha"), detectado("jitomate", clase_bd="sano")]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert inferencia.frutas == ["jitomate"]
    frutos = bd.tablas["frutos"]
    assert [f["fruta_id"] for f in frutos] == ["jitomate", "jitomate"]
    assert [f["clase_id"] for f in frutos] == [5, 4]


def test_lote_sin_fruta_no_manda_el_campo(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=2)
    inferencia.por_foto = [[detectado()], [detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert inferencia.frutas == [None, None]


def test_clase_que_no_existe_en_la_bd_queda_sin_clase(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado(clase_bd="clase_rara")]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    fruto = bd.tablas["frutos"][0]
    assert fruto["clase_id"] is None and fruto["conf_clasificacion"] is None
    assert _estado(bd, lote_id) == "analizado"


def test_sin_detecciones_cierra_el_analisis_sin_frutos(cliente, bd, admin, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert bd.tablas.get("frutos", []) == []
    assert len(admin.rpc_llamadas) == 1
    assert _estado(bd, lote_id) == "analizado"


def test_descarta_cajas_vacias(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado(ancho=0), detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert len(bd.tablas["frutos"]) == 1


def test_si_falla_la_inferencia_no_guarda_frutos(cliente, bd, admin, inferencia):
    lote_id = _lote(bd)
    inferencia.por_foto = [[detectado()], InferenciaError("sin servicio")]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 202
    assert bd.tablas.get("frutos", []) == []
    assert admin.rpc_llamadas == []
    assert _estado(bd, lote_id) == "error"


def test_si_falta_el_archivo_en_storage_marca_error(cliente, bd, inferencia):
    lote_id = _lote(bd, fotos=1)
    bd.storage.objetos.clear()
    inferencia.por_foto = [[detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert _estado(bd, lote_id) == "error"


def test_si_falla_el_guardado_de_frutos_marca_error(cliente, bd, admin, inferencia):
    lote_id = _lote(bd, fotos=1)
    inferencia.por_foto = [[detectado()]]
    admin.fallar_insert_en.add("frutos")

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert bd.tablas.get("frutos", []) == []
    assert _estado(bd, lote_id) == "error"


def test_si_falla_cerrar_el_analisis_borra_los_frutos_de_esa_corrida(cliente, bd, admin, inferencia):
    lote_id = _lote(bd, fotos=1)
    # Un fruto de otro lote no se toca.
    otro = agregar(bd, "lotes", nombre="Otro", usuario_id=str(USUARIO.id))
    agregar(bd, "frutos", lote_id=otro["id"], foto_id="f", fruta_id="mango")
    inferencia.por_foto = [[detectado(), detectado()]]
    admin.fallar_rpc.add("cerrar_analisis_lote")

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert [f["lote_id"] for f in bd.tablas["frutos"]] == [otro["id"]]
    assert _estado(bd, lote_id) == "error"


def test_un_lote_con_error_se_puede_analizar_de_nuevo(cliente, bd, inferencia):
    lote_id = _lote(bd, estado="error", fotos=1)
    inferencia.por_foto = [[detectado()]]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 202
    assert _estado(bd, lote_id) == "analizado"


def test_un_lote_con_error_borra_los_frutos_viejos_al_reintentar(cliente, bd, inferencia):
    lote_id = _lote(bd, estado="error", fotos=1)
    agregar(bd, "frutos", lote_id=lote_id, foto_id="resto", fruta_id="mango")
    inferencia.por_foto = [[detectado()]]

    assert cliente.post(f"/lotes/{lote_id}/analizar").status_code == 202

    assert [f["foto_id"] for f in bd.tablas["frutos"]] != ["resto"]
    assert len(bd.tablas["frutos"]) == 1
    assert _estado(bd, lote_id) == "analizado"


def test_lote_analizando_vencido_se_puede_reclamar_y_borra_frutos_viejos(cliente, bd, inferencia):
    lote_id = _lote(bd, estado="analizando", fotos=1, updated_at=_hace(11))
    agregar(bd, "frutos", lote_id=lote_id, foto_id="resto", fruta_id="mango")
    # Un fruto de otro lote no se toca.
    otro = agregar(bd, "lotes", nombre="Otro", usuario_id=str(USUARIO.id))
    agregar(bd, "frutos", lote_id=otro["id"], foto_id="f", fruta_id="mango")
    inferencia.por_foto = [[detectado(), detectado()]]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 202
    assert sorted(f["lote_id"] for f in bd.tablas["frutos"]) == sorted([lote_id, lote_id, otro["id"]])
    assert all(f["foto_id"] != "resto" for f in bd.tablas["frutos"])
    assert _estado(bd, lote_id) == "analizado"


def test_el_limite_de_vencido_sale_de_la_configuracion(cliente, bd, inferencia, monkeypatch):
    monkeypatch.setenv("ANALISIS_VENCIDO_MINUTOS", "1")
    from app.config import get_settings

    get_settings.cache_clear()
    try:
        lote_id = _lote(bd, estado="analizando", fotos=1, updated_at=_hace(2))
        inferencia.por_foto = [[detectado()]]

        assert cliente.post(f"/lotes/{lote_id}/analizar").status_code == 202
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


def test_lote_analizando_reciente_responde_409_y_no_toca_nada(cliente, bd):
    lote_id = _lote(bd, estado="analizando", updated_at=_hace(2))
    agregar(bd, "frutos", lote_id=lote_id, foto_id="f", fruta_id="mango")

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 409
    assert "se está analizando" in respuesta.json()["detail"]
    assert len(bd.tablas["frutos"]) == 1


def test_el_reclamo_es_atomico_si_otro_ya_tomo_el_lote_con_error(cliente, bd, inferencia, monkeypatch):
    lote_id = _lote(bd, estado="error", fotos=1)
    foto_vieja = next(l for l in bd.tablas["lotes"] if l["id"] == lote_id).copy()
    # Otra petición ya lo tomó entre la lectura y el reclamo.
    next(l for l in bd.tablas["lotes"] if l["id"] == lote_id)["estado"] = "analizando"
    monkeypatch.setattr("app.routers.analisis.obtener_lote", lambda *_: foto_vieja)
    inferencia.por_foto = [[detectado()]]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 409
    assert inferencia.imagenes == []
    assert bd.tablas.get("frutos", []) == []


def test_el_reclamo_es_atomico_si_otro_ya_tomo_el_lote_vencido(cliente, bd, inferencia, monkeypatch):
    lote_id = _lote(bd, estado="analizando", fotos=1, updated_at=_hace(30))
    foto_vieja = next(l for l in bd.tablas["lotes"] if l["id"] == lote_id).copy()
    # Otra petición ya reclamó el lote vencido: el trigger renovó updated_at.
    next(l for l in bd.tablas["lotes"] if l["id"] == lote_id)["updated_at"] = _hace(0)
    monkeypatch.setattr("app.routers.analisis.obtener_lote", lambda *_: foto_vieja)
    inferencia.por_foto = [[detectado()]]

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 409
    assert inferencia.imagenes == []


def test_lote_ajeno_o_inexistente_responde_404(cliente, bd):
    ajeno = _lote(bd, usuario_id=OTRO_USUARIO_ID)

    for lote_id in (ajeno, "33333333-3333-3333-3333-333333333333"):
        assert cliente.post(f"/lotes/{lote_id}/analizar").status_code == 404
    assert _estado(bd, ajeno) == "borrador"


def test_lote_en_analisis_responde_409(cliente, bd):
    lote_id = _lote(bd, estado="analizando")

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 409
    assert "se está analizando" in respuesta.json()["detail"]


def test_lote_ya_analizado_responde_409_y_conserva_sus_frutos(cliente, bd):
    lote_id = _lote(bd, estado="analizado")
    agregar(bd, "frutos", lote_id=lote_id, foto_id="f", fruta_id="mango")

    respuesta = cliente.post(f"/lotes/{lote_id}/analizar")

    assert respuesta.status_code == 409
    assert "ya fue analizado" in respuesta.json()["detail"]
    assert len(bd.tablas["frutos"]) == 1


def test_sin_fotos_validas_responde_422(cliente, bd):
    sin_fotos = _lote(bd, fotos=0)
    solo_invalidas = _lote(bd, fotos=1)
    for foto in bd.tablas["fotos"]:
        if foto["lote_id"] == solo_invalidas:
            foto["valida"] = False

    for lote_id in (sin_fotos, solo_invalidas):
        respuesta = cliente.post(f"/lotes/{lote_id}/analizar")
        assert respuesta.status_code == 422
        assert "fotos válidas" in respuesta.json()["detail"]
        assert _estado(bd, lote_id) == "borrador"


def test_solo_analiza_las_fotos_validas(cliente, bd, inferencia):
    lote_id = _lote(bd)
    bd.tablas["fotos"][0]["valida"] = False
    inferencia.por_foto = [[detectado()]]

    cliente.post(f"/lotes/{lote_id}/analizar")

    assert inferencia.imagenes == [b"imagen-1"]


def test_sin_sesion_responde_401():
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).post("/lotes/33333333-3333-3333-3333-333333333333/analizar").status_code == 401


def test_el_cliente_manda_fruta_a_inferir_solo_si_la_hay(monkeypatch):
    import httpx

    from app.services.inferencia import ClienteInferencia

    enviados = []

    def falso_post(url, **kwargs):
        enviados.append(kwargs.get("data"))
        return httpx.Response(200, json={"frutos": [], "modelo_version": "v"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", falso_post)
    cliente_http = ClienteInferencia("http://inferencia")

    cliente_http.inferir(b"x", "fresa")
    cliente_http.inferir(b"x")

    assert enviados == [{"fruta": "fresa"}, None]
