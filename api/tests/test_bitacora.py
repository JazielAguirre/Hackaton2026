from app.routers import bitacora as modulo
from tests.conftest import OTRO_USUARIO_ID, USUARIO, agregar

CAMPOS_VACIOS = dict.fromkeys([
    "analisis_id", "analizado_at", "total_frutos", "frutos_sanos", "frutos_separar", "frutos_revision",
    "pct_sanos", "pct_separar", "conteo_por_clase", "grado", "destino_lote", "muestra_pequena", "modelo_version",
])


def _lote(bd, nombre, creado, usuario_id=USUARIO.id, **extra) -> dict:
    """Fila de la vista bitacora_lotes."""
    campos = CAMPOS_VACIOS | dict(
        fruta_principal="mango", parcela=None, zona_id=1, zona_nombre="Valle", latitud=None, longitud=None,
        fecha_cosecha=None, destino_buscado=None, estado="borrador",
    ) | extra
    return agregar(bd, "bitacora_lotes", nombre=nombre, usuario_id=str(usuario_id), created_at=creado, updated_at=creado, **campos)


def test_lista_solo_mis_lotes_del_mas_nuevo_al_mas_antiguo(cliente, bd):
    _lote(bd, "Viejo", "2026-10-10T10:00:00+00:00")
    _lote(bd, "Nuevo", "2026-10-16T10:00:00+00:00")
    _lote(bd, "Ajeno", "2026-10-15T10:00:00+00:00", usuario_id=OTRO_USUARIO_ID)

    respuesta = cliente.get("/bitacora")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert [l["nombre"] for l in cuerpo["lotes"]] == ["Nuevo", "Viejo"]
    assert cuerpo["total"] == 2
    assert cuerpo["lotes"][0]["frutos_por_destino"] is None


def test_filtra_por_fruta_grado_y_zona(cliente, bd):
    _lote(bd, "A mango", "2026-10-16T10:00:00+00:00", grado="A")
    _lote(bd, "B fresa", "2026-10-15T10:00:00+00:00", grado="B", fruta_principal="fresa")
    _lote(bd, "C zona 2", "2026-10-14T10:00:00+00:00", grado="B", zona_id=2)

    def nombres(**params):
        return [l["nombre"] for l in cliente.get("/bitacora", params=params).json()["lotes"]]

    assert nombres(fruta="Fresa") == ["B fresa"]
    assert nombres(grado="B") == ["B fresa", "C zona 2"]
    assert nombres(zona_id=2) == ["C zona 2"]
    assert nombres(fruta="mango", grado="B") == ["C zona 2"]


def test_pagina_los_resultados(cliente, bd):
    for dia in range(1, 6):
        _lote(bd, f"Lote {dia}", f"2026-10-0{dia}T10:00:00+00:00")

    cuerpo = cliente.get("/bitacora", params={"limite": 2, "desplazamiento": 2}).json()

    assert cuerpo["total"] == 5
    assert (cuerpo["limite"], cuerpo["desplazamiento"]) == (2, 2)
    assert [l["nombre"] for l in cuerpo["lotes"]] == ["Lote 3", "Lote 2"]


def test_parametros_invalidos_responden_422(cliente):
    for params in ({"grado": "Z"}, {"limite": 0}, {"limite": 101}, {"desplazamiento": -1}, {"zona_id": 0}):
        assert cliente.get("/bitacora", params=params).status_code == 422


def test_cuenta_los_frutos_por_destino(cliente, bd, monkeypatch):
    # Con 2 filas por consulta se prueba que lee todas las páginas de frutos.
    monkeypatch.setattr(modulo, "FILAS_POR_CONSULTA", 2)
    lote = _lote(bd, "Analizado", "2026-10-16T10:00:00+00:00", estado="analizado")
    _lote(bd, "Sin frutos", "2026-10-15T10:00:00+00:00")
    # RLS de frutos pasa por la tabla lotes: el lote también existe ahí.
    agregar(bd, "lotes", id=lote["id"], nombre="Analizado", usuario_id=str(USUARIO.id))
    for destino in ["exportacion"] * 3 + ["separar", "revision_manual"]:
        agregar(bd, "frutos", lote_id=lote["id"], destino=destino, foto_id="f", fruta_id="mango")

    lotes = cliente.get("/bitacora").json()["lotes"]

    assert lotes[0]["frutos_por_destino"] == {
        "exportacion": 3, "mercado_nacional": 0, "procesamiento": 0, "separar": 1, "revision_manual": 1,
    }
    assert lotes[1]["frutos_por_destino"] is None


def test_sin_sesion_responde_401():
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).get("/bitacora").status_code == 401


def test_filtra_por_parcela_y_devuelve_la_parcela_de_cada_lote(cliente, bd):
    parcela = agregar(bd, "parcelas", nombre="Norte", usuario_id=str(USUARIO.id))["id"]
    otra = agregar(bd, "parcelas", nombre="Sur", usuario_id=str(USUARIO.id))["id"]
    for nombre, dia, parcela_id in (("En norte 1", 3, parcela), ("En sur", 2, otra), ("Viejo", 1, None), ("En norte 2", 4, parcela)):
        lote = agregar(bd, "lotes", nombre=nombre, usuario_id=str(USUARIO.id), parcela_id=parcela_id)
        # La vista y el lote comparten id.
        _lote(bd, nombre, f"2026-10-0{dia}T10:00:00+00:00", id=lote["id"])

    todos = cliente.get("/bitacora").json()["lotes"]
    assert {l["nombre"]: l["parcela_id"] for l in todos} == {
        "En norte 1": parcela, "En sur": otra, "Viejo": None, "En norte 2": parcela,
    }

    filtrado = cliente.get("/bitacora", params={"parcela_id": parcela}).json()
    assert [l["nombre"] for l in filtrado["lotes"]] == ["En norte 2", "En norte 1"]
    assert filtrado["total"] == 2


def test_parcela_sin_lotes_devuelve_lista_vacia(cliente, bd):
    _lote(bd, "Lote", "2026-10-16T10:00:00+00:00")

    cuerpo = cliente.get("/bitacora", params={"parcela_id": "33333333-3333-3333-3333-333333333333"}).json()

    assert cuerpo["total"] == 0
    assert cuerpo["lotes"] == []


def test_parcela_id_invalido_responde_422(cliente):
    assert cliente.get("/bitacora", params={"parcela_id": "no-es-uuid"}).status_code == 422
