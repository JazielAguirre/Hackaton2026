from tests.conftest import USUARIO

NUEVA = {"nombre": "Zona Valles", "municipio": "Ciudad Valles", "estado": "San Luis Potosí", "latitud": 21.98, "longitud": -99.01}


def _con_rol(bd, rol: str) -> None:
    next(p for p in bd.tablas["perfiles"] if p["id"] == str(USUARIO.id))["rol"] = rol


def test_acopio_y_tecnico_registran_zonas(cliente, bd):
    for rol, nombre in (("acopio", "Zona Uno"), ("tecnico", "Zona Dos")):
        _con_rol(bd, rol)

        respuesta = cliente.post("/zonas", json=NUEVA | {"nombre": nombre})

        assert respuesta.status_code == 201
        zona = respuesta.json()
        assert zona["nombre"] == nombre and zona["activa"] is True and zona["latitud"] == 21.98
    assert [z["nombre"] for z in bd.tablas["zonas"]][-2:] == ["Zona Uno", "Zona Dos"]


def test_solo_el_nombre_es_obligatorio(cliente, bd):
    _con_rol(bd, "acopio")

    respuesta = cliente.post("/zonas", json={"nombre": "  Zona Mínima  "})

    assert respuesta.status_code == 201
    assert respuesta.json() | {"id": 0} == {"id": 0, "nombre": "Zona Mínima", "municipio": None, "estado": None,
                                            "latitud": None, "longitud": None, "activa": True}


def test_un_productor_no_puede_registrar_zonas(cliente, bd):
    respuesta = cliente.post("/zonas", json=NUEVA)

    assert respuesta.status_code == 403
    assert "centro de acopio o un técnico" in respuesta.json()["detail"]
    assert len(bd.tablas["zonas"]) == 2


def test_sin_perfil_responde_403(cliente, bd):
    bd.tablas["perfiles"].clear()

    assert cliente.post("/zonas", json=NUEVA).status_code == 403


def test_nombre_repetido_responde_409_sin_importar_acentos_ni_mayusculas(cliente, bd):
    _con_rol(bd, "acopio")
    bd.tablas["zonas"].append({"id": 3, "nombre": "Cañada Alta", "activa": False})

    for nombre in ("valle", " VALLE ", "canada alta"):
        respuesta = cliente.post("/zonas", json={"nombre": nombre})
        assert respuesta.status_code == 409
        assert "Ya existe una zona" in respuesta.json()["detail"]
    assert len(bd.tablas["zonas"]) == 3


def test_datos_invalidos_responden_422(cliente, bd):
    _con_rol(bd, "acopio")
    invalidos = [
        {"nombre": "   "},
        {"nombre": "x" * 81},
        {"nombre": "Zona", "latitud": 91, "longitud": 0},
        {"nombre": "Zona", "latitud": 0, "longitud": -181},
        {"nombre": "Zona", "latitud": 20.0},
        {"nombre": "Zona", "longitud": -99.0},
        {"municipio": "Sin nombre"},
        {"nombre": "Zona", "activa": False},
    ]
    for cuerpo in invalidos:
        assert cliente.post("/zonas", json=cuerpo).status_code == 422, cuerpo
    assert len(bd.tablas["zonas"]) == 2


def test_sin_sesion_responde_401():
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).post("/zonas", json=NUEVA).status_code == 401
