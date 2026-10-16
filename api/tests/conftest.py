import os

# Las pruebas no deben depender de api/.env ni de claves reales.
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-de-prueba")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-de-prueba")

from uuid import UUID  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.deps import Usuario, cliente_admin, cliente_usuario, usuario_actual  # noqa: E402
from app.main import app  # noqa: E402
from app.services.inferencia import (  # noqa: E402
    FrutoDetectado,
    ResultadoInferencia,
    cliente_inferencia,
)
from tests.fakes import FakeStorage, FakeSupabase  # noqa: E402

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
            {"id": 3, "fruta_id": "mango", "codigo": "otro_defecto", "nombre": "Otro defecto"},
            {"id": 4, "fruta_id": "jitomate", "codigo": "sano", "nombre": "Sano"},
            {"id": 5, "fruta_id": "jitomate", "codigo": "pudricion_mancha", "nombre": "Pudrición o mancha"},
            {"id": 6, "fruta_id": "fresa", "codigo": "sana", "nombre": "Sana"},
            {"id": 7, "fruta_id": "fresa", "codigo": "moho_gris", "nombre": "Moho gris"},
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
def admin(bd: FakeSupabase) -> FakeSupabase:
    """La service role: ve las mismas tablas y archivos que `bd`, pero sin RLS."""
    otro = FakeSupabase(None)
    otro.tablas = bd.tablas
    otro.storage = FakeStorage(None)
    otro.storage.objetos = bd.storage.objetos
    return otro


def detectado(fruta: str = "mango", clase_bd: str | None = "sano", conf: float | None = 0.9, **caja) -> FrutoDetectado:
    return FrutoDetectado(
        fruta=fruta,
        caja_x=caja.get("x", 0.1), caja_y=caja.get("y", 0.2),
        caja_ancho=caja.get("ancho", 0.3), caja_alto=caja.get("alto", 0.25),
        conf_deteccion=0.88, clase_bd=clase_bd, conf_clasificacion=conf if clase_bd else None,
    )


class InferenciaFalsa:
    """Devuelve una lista de frutos por cada foto (en orden); una excepción simula un fallo."""

    def __init__(self) -> None:
        self.por_foto: list[list[FrutoDetectado] | Exception] = []
        self.imagenes: list[bytes] = []
        # La fruta que se mandó con cada foto (None si el lote no tenía fruta).
        self.frutas: list[str | None] = []

    def inferir(self, imagen: bytes, fruta: str | None = None) -> ResultadoInferencia:
        resultado = self.por_foto[len(self.imagenes)]
        self.imagenes.append(imagen)
        self.frutas.append(fruta)
        if isinstance(resultado, Exception):
            raise resultado
        return ResultadoInferencia(frutos=resultado, modelo_version="prueba123")


@pytest.fixture
def inferencia() -> InferenciaFalsa:
    return InferenciaFalsa()


@pytest.fixture
def cliente(bd: FakeSupabase, admin: FakeSupabase, inferencia: InferenciaFalsa):
    """API con sesión iniciada como USUARIO, la base de datos falsa y la inferencia falsa."""
    app.dependency_overrides[usuario_actual] = lambda: USUARIO
    app.dependency_overrides[cliente_usuario] = lambda: bd
    app.dependency_overrides[cliente_admin] = lambda: admin
    app.dependency_overrides[cliente_inferencia] = lambda: inferencia
    yield TestClient(app)
    app.dependency_overrides.clear()
