from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import APIError

from app.deps import cliente_anon
from app.errores import registrar_manejadores
from app.main import app
from tests.fakes import FakeAnon

USUARIO_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def cliente_auth():
    """Valida tokens de verdad (con un Supabase Auth falso), sin saltarse usuario_actual."""
    usuario = SimpleNamespace(id=USUARIO_ID, email="productor@ejemplo.com")
    app.dependency_overrides[cliente_anon] = lambda: FakeAnon({"token-valido": usuario})
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_sin_token_responde_401(cliente_auth):
    respuesta = cliente_auth.get("/yo")
    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Inicia sesión para continuar"


def test_esquema_distinto_de_bearer_responde_401(cliente_auth):
    respuesta = cliente_auth.get("/yo", headers={"Authorization": "Basic abc"})
    assert respuesta.status_code == 401


def test_token_rechazado_por_supabase_responde_401(cliente_auth):
    respuesta = cliente_auth.get("/yo", headers={"Authorization": "Bearer token-falso"})
    assert respuesta.status_code == 401
    assert "vuelve a iniciar sesión" in respuesta.json()["detail"]


def test_token_valido_devuelve_al_usuario(cliente_auth):
    respuesta = cliente_auth.get("/yo", headers={"Authorization": "Bearer token-valido"})
    assert respuesta.status_code == 200
    assert respuesta.json() == {"id": USUARIO_ID, "email": "productor@ejemplo.com"}


def _app_que_falla(codigo: str) -> TestClient:
    mini = FastAPI()
    registrar_manejadores(mini)

    @mini.get("/falla")
    def falla():
        raise APIError({"message": "detalle interno", "code": codigo})

    return TestClient(mini)


def test_jwt_vencido_en_postgrest_responde_401():
    respuesta = _app_que_falla("PGRST303").get("/falla")
    assert respuesta.status_code == 401


def test_otro_error_de_postgrest_responde_502_sin_detalles():
    respuesta = _app_que_falla("42P01").get("/falla")
    assert respuesta.status_code == 502
    assert "detalle interno" not in respuesta.text
