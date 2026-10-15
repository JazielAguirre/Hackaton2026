from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_responde_ok():
    respuesta = client.get("/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok"}


def test_cors_permite_el_origen_del_front():
    for origen in ("http://localhost:5173", "http://127.0.0.1:5173"):
        respuesta = client.options(
            "/health",
            headers={
                "Origin": origen,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert respuesta.headers["access-control-allow-origin"] == origen


def test_cors_rechaza_otros_origenes():
    respuesta = client.options(
        "/health",
        headers={
            "Origin": "http://sitio-malicioso.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in respuesta.headers
