import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import OTRO_USUARIO_ID, USUARIO, agregar

NOMBRE_LOTE = {"nombre": "Lote norte"}


@pytest.fixture
def lote_minimo(bd) -> dict:
    """Lo mínimo para crear un lote: nombre y una parcela activa del usuario."""
    return NOMBRE_LOTE | {"parcela_id": _parcela(bd)}


def test_crea_lote_con_la_zona_del_perfil(cliente, bd, lote_minimo):
    respuesta = cliente.post("/lotes", json=lote_minimo)

    assert respuesta.status_code == 201
    lote = respuesta.json()
    assert lote["nombre"] == "Lote norte"
    assert lote["usuario_id"] == str(USUARIO.id)
    assert lote["estado"] == "borrador"
    assert lote["zona_id"] == 1
    assert len(bd.tablas["lotes"]) == 1


def test_crea_lote_completo_y_normaliza_la_fruta(cliente, lote_minimo):
    respuesta = cliente.post(
        "/lotes",
        json={
            "parcela_id": lote_minimo["parcela_id"],
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


def test_fruta_no_soportada_responde_422(cliente, bd, lote_minimo):
    respuesta = cliente.post("/lotes", json=lote_minimo | {"fruta_principal": "platano"})

    assert respuesta.status_code == 422
    assert "Fruta no soportada" in respuesta.json()["detail"]
    assert bd.tablas.get("lotes", []) == []


def test_fruta_inactiva_responde_422(cliente, lote_minimo):
    respuesta = cliente.post("/lotes", json=lote_minimo | {"fruta_principal": "pina"})
    assert respuesta.status_code == 422


def test_zona_inactiva_o_inexistente_responde_422(cliente, lote_minimo):
    for zona_id in (2, 99):
        respuesta = cliente.post("/lotes", json=lote_minimo | {"zona_id": zona_id})
        assert respuesta.status_code == 422
        assert "zona" in respuesta.json()["detail"]


def test_datos_invalidos_responden_422(cliente, lote_minimo):
    invalidos = [
        lote_minimo | {"nombre": "   "},
        lote_minimo | {"latitud": 100},
        lote_minimo | {"longitud": -200},
        lote_minimo | {"destino_buscado": "luna"},
        lote_minimo | {"fecha_cosecha": "ayer"},
    ]
    for datos in invalidos:
        assert cliente.post("/lotes", json=datos).status_code == 422, datos


def test_no_permite_elegir_dueno_ni_estado(cliente, lote_minimo):
    for extra in ({"usuario_id": "22222222-2222-2222-2222-222222222222"}, {"estado": "analizado"}):
        assert cliente.post("/lotes", json=lote_minimo | extra).status_code == 422


def test_sin_sesion_responde_401(lote_minimo):
    app.dependency_overrides.clear()
    assert TestClient(app).post("/lotes", json=lote_minimo).status_code == 401


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


def _parcela(bd, nombre="Parcela 3", zona_id=None, activa=True, usuario_id=USUARIO.id) -> str:
    return agregar(bd, "parcelas", nombre=nombre, zona_id=zona_id, activa=activa, usuario_id=str(usuario_id))["id"]


def test_crea_lote_con_parcela_registrada(cliente, bd):
    parcela_id = _parcela(bd)

    respuesta = cliente.post("/lotes", json=NOMBRE_LOTE | {"parcela_id": parcela_id})

    assert respuesta.status_code == 201
    lote = respuesta.json()
    assert lote["parcela_id"] == parcela_id
    # El nombre libre se completa con el de la parcela y la zona sale del perfil (la parcela no tiene).
    assert lote["parcela"] == "Parcela 3"
    assert lote["zona_id"] == 1


def test_sin_parcela_responde_422(cliente, bd):
    respuesta = cliente.post("/lotes", json=NOMBRE_LOTE)

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == "Elige la parcela del lote"
    assert bd.tablas.get("lotes", []) == []


def test_el_lote_usa_la_zona_de_su_parcela(cliente, bd):
    bd.tablas["zonas"].append({"id": 3, "nombre": "Costa", "activa": True})
    parcela_id = _parcela(bd, zona_id=3)

    respuesta = cliente.post("/lotes", json=NOMBRE_LOTE | {"parcela_id": parcela_id})

    assert respuesta.json()["zona_id"] == 3


def test_respeta_el_nombre_de_parcela_que_manda_el_cliente(cliente, bd):
    parcela_id = _parcela(bd)

    respuesta = cliente.post("/lotes", json=NOMBRE_LOTE | {"parcela_id": parcela_id, "parcela": "Otro nombre"})

    assert respuesta.json()["parcela"] == "Otro nombre"


def test_parcela_ajena_inactiva_o_inexistente_responde_422(cliente, bd):
    ajena = _parcela(bd, nombre="Ajena", usuario_id=OTRO_USUARIO_ID)
    inactiva = _parcela(bd, nombre="Vieja", activa=False)

    for parcela_id in (ajena, inactiva, "33333333-3333-3333-3333-333333333333"):
        respuesta = cliente.post("/lotes", json=NOMBRE_LOTE | {"parcela_id": parcela_id})
        assert respuesta.status_code == 422
        assert "parcela" in respuesta.json()["detail"]
    assert bd.tablas.get("lotes", []) == []
