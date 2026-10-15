import os

# Las pruebas no deben depender de api/.env ni de claves reales.
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-de-prueba")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-de-prueba")

from uuid import UUID  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.deps import Usuario, cliente_usuario, usuario_actual  # noqa: E402
from app.main import app  # noqa: E402
from tests.fakes import FakeSupabase  # noqa: E402

USUARIO = Usuario(
    id=UUID("11111111-1111-1111-1111-111111111111"),
    email="productor@ejemplo.com",
    token="token-de-prueba",
)
OTRO_USUARIO_ID = "22222222-2222-2222-2222-222222222222"


def catalogos() -> dict[str, list[dict]]:
    return {
        "frutas": [
            {"id": "mango", "nombre": "Mango", "activa": True},
            {"id": "jitomate", "nombre": "Jitomate", "activa": True},
            {"id": "fresa", "nombre": "Fresa", "activa": True},
            {"id": "pina", "nombre": "Piña", "activa": False},
        ],
        "clases": [
            {"id": 1, "fruta_id": "mango", "codigo": "sano", "nombre": "Sano"},
            {"id": 2, "fruta_id": "mango", "codigo": "antracnosis", "nombre": "Antracnosis"},
        ],
        "zonas": [
            {"id": 1, "nombre": "Valle", "activa": True},
            {"id": 2, "nombre": "Sierra", "activa": False},
        ],
        "perfiles": [
            {"id": str(USUARIO.id), "zona_id": 1, "rol": "productor"},
            {"id": OTRO_USUARIO_ID, "zona_id": 1, "rol": "productor"},
        ],
    }


def agregar(bd: FakeSupabase, tabla: str, **campos) -> dict:
    """Mete una fila directo en la base falsa (sin pasar por RLS) y la devuelve."""
    fila = bd.completar(tabla, campos)
    bd.tablas.setdefault(tabla, []).append(fila)
    return fila


@pytest.fixture
def bd() -> FakeSupabase:
    return FakeSupabase(USUARIO.id, catalogos())


@pytest.fixture
def cliente(bd: FakeSupabase):
    """API con sesión iniciada como USUARIO y la base de datos falsa."""
    app.dependency_overrides[usuario_actual] = lambda: USUARIO
    app.dependency_overrides[cliente_usuario] = lambda: bd
    yield TestClient(app)
    app.dependency_overrides.clear()
