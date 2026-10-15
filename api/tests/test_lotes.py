from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import USUARIO

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
