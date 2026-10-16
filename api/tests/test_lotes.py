from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import OTRO_USUARIO_ID, USUARIO, agregar

LOTE_MINIMO = {"nombre": "Lote norte"}


def test_crea_lote_con_la_zona_del_perfil(cliente, bd):
    respuesta = cliente.post("/lotes", json=LOTE_MINIMO)

    assert respuesta.status_code == 201
    lote = respuesta.json()
    assert lote["nombre"] == "Lote norte"
    assert lote["usuario_id"] == str(USUARIO.id)
    assert lote["estado"] == "borrador"
    assert lote["zona_id"] == 1
    assert len(bd.tablas["lotes"]) == 1


def test_crea_lote_completo_y_normaliza_la_fruta(cliente):
    respuesta = cliente.post(
        "/lotes",
        json={
            "nombre": "  Lote sur  ",
            "fruta_principal": " Mango ",
            "parcela": "Parcela 3",
            "zona_id": 1,
            "latitud": 19.4326,
            "longitud": -99.1332,
            "fecha_cosecha": "2026-10-14",
            "destino_buscado": "exportacion",
        },
    )

    assert respuesta.status_code == 201
    lote = respuesta.json()
    assert lote["nombre"] == "Lote sur"
    assert lote["fruta_principal"] == "mango"
    assert lote["fecha_cosecha"] == "2026-10-14"
    assert lote["destino_buscado"] == "exportacion"


def test_fruta_no_soportada_responde_422(cliente, bd):
    respuesta = cliente.post("/lotes", json=LOTE_MINIMO | {"fruta_principal": "platano"})

    assert respuesta.status_code == 422
    assert "Fruta no soportada" in respuesta.json()["detail"]
    assert bd.tablas.get("lotes", []) == []


def test_fruta_inactiva_responde_422(cliente):
    respuesta = cliente.post("/lotes", json=LOTE_MINIMO | {"fruta_principal": "pina"})
    assert respuesta.status_code == 422


def test_zona_inactiva_o_inexistente_responde_422(cliente):
    for zona_id in (2, 99):
        respuesta = cliente.post("/lotes", json=LOTE_MINIMO | {"zona_id": zona_id})
        assert respuesta.status_code == 422
        assert "zona" in respuesta.json()["detail"]


def test_datos_invalidos_responden_422(cliente):
    invalidos = [
        {"nombre": "   "},
        LOTE_MINIMO | {"latitud": 100},
        LOTE_MINIMO | {"longitud": -200},
        LOTE_MINIMO | {"destino_buscado": "luna"},
        LOTE_MINIMO | {"fecha_cosecha": "ayer"},
    ]
    for datos in invalidos:
        assert cliente.post("/lotes", json=datos).status_code == 422, datos


def test_no_permite_elegir_dueno_ni_estado(cliente):
    for extra in ({"usuario_id": "22222222-2222-2222-2222-222222222222"}, {"estado": "analizado"}):
        assert cliente.post("/lotes", json=LOTE_MINIMO | extra).status_code == 422


def test_sin_sesion_responde_401():
    app.dependency_overrides.clear()
    assert TestClient(app).post("/lotes", json=LOTE_MINIMO).status_code == 401


# ---------- GET /lotes/{id} ----------

def _analisis(bd, lote_id, creado: str, grado: str) -> dict:
    return agregar(
        bd, "analisis_lote", lote_id=lote_id, created_at=creado, total_frutos=10, frutos_sanos=9,
        frutos_separar=0, frutos_revision=1, pct_sanos=90.0, pct_separar=0.0,
        conteo_por_clase={"mango": {"sano": 9, "antracnosis": 1}}, grado=grado,
        destino_lote="mercado_nacional", muestra_pequena=True, modelo_version="prueba-1",
    )


def _fruto(bd, lote_id, foto_id, clase_id) -> dict:
    return agregar(
        bd, "frutos", lote_id=lote_id, foto_id=foto_id, fruta_id="mango", conf_deteccion=0.9,
        caja_x=0.1, caja_y=0.2, caja_ancho=0.3, caja_alto=0.4, clase_id=clase_id,
        conf_clasificacion=0.8 if clase_id else None,
        destino="exportacion" if clase_id else "revision_manual", requiere_revision=clase_id is None,
    )


def test_detalle_de_lote_sin_analisis(cliente, bd):
    lote = agregar(bd, "lotes", nombre="Lote nuevo", usuario_id=str(USUARIO.id), zona_id=1)

    respuesta = cliente.get(f"/lotes/{lote['id']}")

    assert respuesta.status_code == 200
    detalle = respuesta.json()
    assert detalle["nombre"] == "Lote nuevo"
    assert detalle["zona_nombre"] == "Valle"
    assert detalle["analisis"] is None
    assert detalle["fotos"] == detalle["frutos"] == detalle["sugerencias"] == []


def test_detalle_trae_fotos_con_url_firmada(cliente, bd):
    lote = agregar(bd, "lotes", nombre="Lote", usuario_id=str(USUARIO.id))
    ruta = f"{USUARIO.id}/{lote['id']}/foto.jpg"
    agregar(bd, "fotos", lote_id=lote["id"], storage_path=ruta, ancho=640, alto=480)
    agregar(bd, "fotos", lote_id=lote["id"], storage_path=f"{USUARIO.id}/{lote['id']}/perdida.jpg")
    bd.storage.objetos[ruta] = (b"jpg", {})

    fotos = cliente.get(f"/lotes/{lote['id']}").json()["fotos"]

    assert fotos[0]["url"].startswith(f"https://storage.test/{ruta}")
    assert fotos[0]["url_marcada"] is None
    assert fotos[1]["url"] is None  # el archivo no existe en Storage


def test_detalle_usa_el_analisis_mas_reciente(cliente, bd):
    lote = agregar(bd, "lotes", nombre="Lote", usuario_id=str(USUARIO.id), estado="analizado")
    foto = agregar(bd, "fotos", lote_id=lote["id"], storage_path="x.jpg")
    viejo = _analisis(bd, lote["id"], "2026-10-14T10:00:00+00:00", "C")
    nuevo = _analisis(bd, lote["id"], "2026-10-15T10:00:00+00:00", "B")
    agregar(bd, "sugerencias", lote_id=lote["id"], analisis_id=viejo["id"], texto="vieja", origen="plantilla")
    agregar(bd, "sugerencias", lote_id=lote["id"], analisis_id=nuevo["id"], texto="nueva", origen="plantilla")
    _fruto(bd, lote["id"], foto["id"], clase_id=1)
    _fruto(bd, lote["id"], foto["id"], clase_id=None)

    detalle = cliente.get(f"/lotes/{lote['id']}").json()

    assert detalle["analisis"]["id"] == nuevo["id"]
    assert detalle["analisis"]["grado"] == "B"
    assert [s["texto"] for s in detalle["sugerencias"]] == ["nueva"]
    assert detalle["frutos"][0]["clase"] == {"codigo": "sano", "nombre": "Sano"}
    assert detalle["frutos"][1]["clase"] is None
    assert detalle["frutos"][1]["destino"] == "revision_manual"


def test_detalle_de_lote_ajeno_o_inexistente_responde_404(cliente, bd):
    ajeno = agregar(bd, "lotes", nombre="Ajeno", usuario_id=OTRO_USUARIO_ID)
    for lote_id in (ajeno["id"], "33333333-3333-3333-3333-333333333333"):
        respuesta = cliente.get(f"/lotes/{lote_id}")
        assert respuesta.status_code == 404
        assert respuesta.json()["detail"] == "Lote no encontrado"
