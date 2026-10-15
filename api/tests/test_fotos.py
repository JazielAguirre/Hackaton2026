import io

import pytest
from PIL import Image

from app.services import imagenes
from app.services.imagenes import ImagenInvalida, preparar_imagen
from tests.conftest import OTRO_USUARIO_ID, USUARIO


def _imagen(ancho: int = 640, alto: int = 480, formato: str = "JPEG", modo: str = "RGB", exif=None) -> bytes:
    salida = io.BytesIO()
    opciones = {"exif": exif} if exif is not None else {}
    Image.new(modo, (ancho, alto), "orange").save(salida, format=formato, **opciones)
    return salida.getvalue()


def _lote(bd, usuario_id=USUARIO.id, estado="borrador") -> str:
    fila = bd.completar("lotes", {"nombre": "Lote", "usuario_id": str(usuario_id), "estado": estado})
    bd.tablas.setdefault("lotes", []).append(fila)
    return fila["id"]


def _subir(cliente, lote_id, *archivos):
    return cliente.post(
        f"/lotes/{lote_id}/fotos",
        files=[("fotos", (nombre, contenido, "image/jpeg")) for nombre, contenido in archivos],
    )


def test_sube_fotos_en_la_carpeta_del_usuario(cliente, bd):
    lote_id = _lote(bd)

    respuesta = _subir(cliente, lote_id, ("a.jpg", _imagen()), ("b.jpg", _imagen()))

    assert respuesta.status_code == 201
    fotos = respuesta.json()
    assert len(fotos) == 2
    for foto in fotos:
        assert foto["storage_path"] == f"{USUARIO.id}/{lote_id}/{foto['id']}.jpg"
        assert foto["valida"] is True
        contenido, opciones = bd.storage.objetos[foto["storage_path"]]
        assert opciones["content-type"] == "image/jpeg"
        assert contenido[:2] == b"\xff\xd8"  # es JPEG
    assert len(bd.tablas["fotos"]) == 2


def test_reduce_fotos_grandes(cliente, bd):
    respuesta = _subir(cliente, _lote(bd), ("grande.jpg", _imagen(4000, 3000)))

    foto = respuesta.json()[0]
    assert (foto["ancho"], foto["alto"]) == (1600, 1200)


def test_convierte_png_con_transparencia_a_jpeg(cliente, bd):
    respuesta = _subir(cliente, _lote(bd), ("foto.png", _imagen(formato="PNG", modo="RGBA")))

    assert respuesta.status_code == 201
    contenido, _ = bd.storage.objetos[respuesta.json()[0]["storage_path"]]
    assert Image.open(io.BytesIO(contenido)).format == "JPEG"


def test_endereza_la_foto_y_quita_el_exif():
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientación: girada 90°, como la guardan muchos celulares
    exif[0x010F] = "Celular"

    preparada = preparar_imagen(_imagen(400, 200, exif=exif), "rotada.jpg")

    assert (preparada.ancho, preparada.alto) == (200, 400)
    assert len(Image.open(io.BytesIO(preparada.contenido)).getexif()) == 0


def test_rechaza_archivos_que_no_son_imagen_sin_subir_ninguno(cliente, bd):
    respuesta = _subir(cliente, _lote(bd), ("bien.jpg", _imagen()), ("notas.txt", b"hola"))

    assert respuesta.status_code == 422
    assert "notas.txt" in respuesta.json()["detail"]
    assert bd.storage.objetos == {}
    assert bd.tablas.get("fotos", []) == []


def test_rechaza_archivos_vacios_o_de_mas_de_10_mb():
    with pytest.raises(ImagenInvalida, match="vacío"):
        preparar_imagen(b"", "vacia.jpg")
    with pytest.raises(ImagenInvalida, match="10 MB"):
        preparar_imagen(b"0" * (imagenes.MAX_BYTES + 1), "pesada.jpg")


def test_rechaza_resoluciones_enormes(monkeypatch):
    monkeypatch.setattr(imagenes, "MAX_PIXELES", 1000)
    with pytest.raises(ImagenInvalida, match="resolución"):
        preparar_imagen(_imagen(100, 100), "enorme.jpg")


def test_lote_ajeno_o_inexistente_responde_404(cliente, bd):
    ajeno = _lote(bd, usuario_id=OTRO_USUARIO_ID)
    for lote_id in (ajeno, "33333333-3333-3333-3333-333333333333"):
        respuesta = _subir(cliente, lote_id, ("a.jpg", _imagen()))
        assert respuesta.status_code == 404
    assert bd.storage.objetos == {}


def test_lote_en_analisis_responde_409(cliente, bd):
    respuesta = _subir(cliente, _lote(bd, estado="analizando"), ("a.jpg", _imagen()))
    assert respuesta.status_code == 409


def test_limita_las_fotos_por_peticion(cliente, bd):
    archivos = [(f"{i}.jpg", _imagen(10, 10)) for i in range(21)]
    assert _subir(cliente, _lote(bd), *archivos).status_code == 422


def test_id_de_lote_invalido_responde_422(cliente):
    assert _subir(cliente, "no-es-uuid", ("a.jpg", _imagen())).status_code == 422


def test_si_falla_el_registro_borra_los_archivos_subidos(cliente, bd):
    bd.fallar_insert_en.add("fotos")

    respuesta = _subir(cliente, _lote(bd), ("a.jpg", _imagen()), ("b.jpg", _imagen()))

    assert respuesta.status_code == 502
    assert bd.storage.objetos == {}


def test_si_falla_una_subida_borra_las_anteriores(cliente, bd):
    bd.storage.fallar_despues_de = 1

    respuesta = _subir(cliente, _lote(bd), ("a.jpg", _imagen()), ("b.jpg", _imagen()))

    assert respuesta.status_code == 502
    assert bd.storage.objetos == {}
    assert bd.tablas.get("fotos", []) == []
