from tests.conftest import OTRO_USUARIO_ID, USUARIO, agregar


def _lote_analizado(bd, usuario_id=USUARIO.id, estado="analizado") -> str:
    lote = agregar(
        bd, "lotes", nombre="Lote del norte", usuario_id=str(usuario_id), estado=estado, fruta_principal="mango",
        parcela="El Mirador", zona_id=1, fecha_cosecha="2026-10-14",
    )
    agregar(
        bd, "analisis_lote", lote_id=lote["id"], total_frutos=4, frutos_sanos=3, frutos_separar=1, frutos_revision=1,
        pct_sanos=75.0, pct_separar=25.0, conteo_por_clase={}, grado="rechazo", destino_lote="separar",
        muestra_pequena=True, modelo_version="prueba123",
    )
    foto = agregar(bd, "fotos", lote_id=lote["id"], storage_path="x")
    for clase_id, destino in [(1, "exportacion"), (1, "exportacion"), (1, "exportacion"), (2, "separar"), (None, "revision_manual")]:
        agregar(bd, "frutos", lote_id=lote["id"], foto_id=foto["id"], fruta_id="mango", clase_id=clase_id, destino=destino)
    agregar(bd, "sugerencias", lote_id=lote["id"], analisis_id=bd.tablas["analisis_lote"][0]["id"], texto="Separa los frutos rojos", origen="plantilla")
    return lote["id"]


def test_descarga_el_pdf_de_un_lote_analizado(cliente, bd):
    lote_id = _lote_analizado(bd)

    respuesta = cliente.get(f"/lotes/{lote_id}/reporte.pdf")

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert f"reporte-lote-{lote_id[:8]}.pdf" in respuesta.headers["content-disposition"]
    assert respuesta.content.startswith(b"%PDF")


def test_el_pdf_trae_los_datos_el_grado_y_el_aviso(cliente, bd):
    lote_id = _lote_analizado(bd)

    texto = cliente.get(f"/lotes/{lote_id}/reporte.pdf").content.decode("latin-1")

    for esperado in ["Lote del norte", "El Mirador", "Valle", "Rechazo", "prueba123", "Antracnosis", "Sin clasificar", "Separa los frutos rojos"]:
        assert esperado in texto
    # Los acentos van como códigos octales en el PDF: se comprueba el resto del aviso.
    assert "certificaci" in texto and "exportaci" in texto and "Preclasificaci" in texto
    assert "75.0%" in texto


def test_lote_sin_analizar_responde_409(cliente, bd):
    for estado in ("borrador", "analizando", "error"):
        lote_id = _lote_analizado(bd, estado=estado)
        respuesta = cliente.get(f"/lotes/{lote_id}/reporte.pdf")
        assert respuesta.status_code == 409
        assert "no está analizado" in respuesta.json()["detail"]


def test_lote_ajeno_o_inexistente_responde_404(cliente, bd):
    ajeno = _lote_analizado(bd, usuario_id=OTRO_USUARIO_ID)

    for lote_id in (ajeno, "33333333-3333-3333-3333-333333333333"):
        assert cliente.get(f"/lotes/{lote_id}/reporte.pdf").status_code == 404


def test_lote_sin_frutos_tambien_genera_pdf(cliente, bd):
    lote_id = _lote_analizado(bd)
    bd.tablas["frutos"].clear()
    bd.tablas["analisis_lote"][0].update(total_frutos=0, frutos_sanos=0, frutos_separar=0, frutos_revision=0,
                                         pct_sanos=None, pct_separar=None, grado=None, destino_lote=None)

    respuesta = cliente.get(f"/lotes/{lote_id}/reporte.pdf")

    assert respuesta.status_code == 200
    assert b"Sin frutos detectados" in respuesta.content
