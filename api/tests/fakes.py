"""Dobles de prueba de Supabase para no depender de la red ni de claves reales."""

import copy
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Callable
from uuid import uuid4

from postgrest import APIError
from storage3.utils import StorageException
from supabase_auth.errors import AuthApiError

# Tablas cuyas filas son del usuario a través de su lote, como en las políticas RLS.
TABLAS_POR_LOTE = {"fotos", "frutos", "analisis_lote", "sugerencias"}


class FakeAuth:
    def __init__(self, usuarios: dict[str, SimpleNamespace] | None = None) -> None:
        # token -> usuario
        self.usuarios = usuarios or {}

    def get_user(self, jwt: str) -> SimpleNamespace:
        if jwt not in self.usuarios:
            raise AuthApiError("invalid JWT", 403, "bad_jwt")
        return SimpleNamespace(user=self.usuarios[jwt])


class FakeAnon:
    """Sustituye a cliente_anon: solo se usa para validar tokens."""

    def __init__(self, usuarios: dict[str, SimpleNamespace] | None = None) -> None:
        self.auth = FakeAuth(usuarios)


class FakeSupabase:
    """Base de datos en memoria. Con usuario_id imita RLS; sin él, la service role."""

    def __init__(self, usuario_id: Any = None, tablas: dict[str, list[dict]] | None = None) -> None:
        self.usuario_id = str(usuario_id) if usuario_id else None
        self.tablas: dict[str, list[dict]] = copy.deepcopy(tablas or {})
        self.storage = FakeStorage(self.usuario_id)
        # Tablas donde un insert falla a propósito, para probar el manejo de errores.
        self.fallar_insert_en: set[str] = set()
        # Funciones rpc que fallan a propósito, y las que se llamaron: (nombre, parámetros).
        self.fallar_rpc: set[str] = set()
        self.rpc_llamadas: list[tuple[str, dict]] = []
        # Lo que se mandó a insertar, tal cual (antes de los valores por defecto de la base).
        self.inserciones: list[tuple[str, list[dict]]] = []

    def table(self, nombre: str) -> "FakeQuery":
        return FakeQuery(self, nombre)

    def rpc(self, nombre: str, parametros: dict) -> "FakeRpc":
        return FakeRpc(self, nombre, parametros)

    def visible(self, tabla: str, fila: dict) -> bool:
        if self.usuario_id is None:
            return True
        if tabla in ("lotes", "bitacora_lotes", "parcelas"):
            return str(fila["usuario_id"]) == self.usuario_id
        if tabla == "perfiles":
            return str(fila["id"]) == self.usuario_id
        if tabla in TABLAS_POR_LOTE:
            return any(
                str(lote["id"]) == str(fila["lote_id"]) and self.visible("lotes", lote)
                for lote in self.tablas.get("lotes", [])
            )
        return True

    def completar(self, tabla: str, fila: dict) -> dict:
        """Pone los valores por defecto que pondría la base de datos."""
        ahora = datetime.now(timezone.utc).isoformat()
        if tabla == "zonas":
            fila.setdefault("id", max([z["id"] for z in self.tablas.get("zonas", [])], default=0) + 1)
        else:
            fila.setdefault("id", str(uuid4()))
        fila.setdefault("created_at", ahora)
        # Como en la base real, select("*") trae todas las columnas (null si no hay valor).
        defaults: dict[str, dict[str, Any]] = {
            "lotes": {
                "usuario_id": self.usuario_id, "estado": "borrador", "updated_at": ahora,
                "fruta_principal": None, "parcela": None, "parcela_id": None, "zona_id": None, "latitud": None,
                "longitud": None, "fecha_cosecha": None, "destino_buscado": None,
            },
            "fotos": {
                "ancho": None, "alto": None, "valida": True, "motivo_rechazo": None,
                "nitidez": None, "brillo": None,
            },
            "sugerencias": {"ficha_id": None},
            # La base real asigna el destino con un trigger; aquí solo se simula el valor por defecto.
            "frutos": {"destino": "revision_manual", "requiere_revision": True},
            "zonas": {"municipio": None, "estado": None, "latitud": None, "longitud": None, "activa": True},
        }
        for campo, valor in defaults.get(tabla, {}).items():
            fila.setdefault(campo, valor)
        return fila


class FakeQuery:
    def __init__(self, bd: FakeSupabase, tabla: str) -> None:
        self.bd = bd
        self.tabla = tabla
        self.operacion = "select"
        self.datos: Any = None
        self.filtros: list[Callable[[dict], bool]] = []
        self.orden: tuple[str, bool] | None = None
        self.limite: int | None = None
        self.rango: tuple[int, int] | None = None
        self.contar = False

    def select(self, *_columnas: str, count: str | None = None) -> "FakeQuery":
        self.contar = count == "exact"
        return self

    def insert(self, datos: dict | list[dict]) -> "FakeQuery":
        self.operacion, self.datos = "insert", datos
        return self

    def update(self, datos: dict) -> "FakeQuery":
        self.operacion, self.datos = "update", datos
        return self

    def delete(self) -> "FakeQuery":
        self.operacion = "delete"
        return self

    def eq(self, columna: str, valor: Any) -> "FakeQuery":
        self.filtros.append(lambda fila: str(fila.get(columna)) == str(valor))
        return self

    def in_(self, columna: str, valores: list[Any]) -> "FakeQuery":
        permitidos = {str(v) for v in valores}
        self.filtros.append(lambda fila: str(fila.get(columna)) in permitidos)
        return self

    def order(self, columna: str, desc: bool = False) -> "FakeQuery":
        self.orden = (columna, desc)
        return self

    def limit(self, n: int) -> "FakeQuery":
        self.limite = n
        return self

    def range(self, desde: int, hasta: int) -> "FakeQuery":
        self.rango = (desde, hasta)
        return self

    def execute(self) -> SimpleNamespace:
        filas = self.bd.tablas.setdefault(self.tabla, [])

        if self.operacion == "insert":
            if self.tabla in self.bd.fallar_insert_en:
                raise APIError({"code": "XX000", "message": "fallo simulado"})
            nuevas = self.datos if isinstance(self.datos, list) else [self.datos]
            self.bd.inserciones.append((self.tabla, copy.deepcopy(nuevas)))
            nuevas = [self.bd.completar(self.tabla, dict(fila)) for fila in nuevas]
            if not all(self.bd.visible(self.tabla, fila) for fila in nuevas):
                raise APIError({"code": "42501", "message": "new row violates row-level security policy"})
            filas.extend(nuevas)
            return SimpleNamespace(data=copy.deepcopy(nuevas))

        seleccion = [f for f in filas if self.bd.visible(self.tabla, f) and all(p(f) for p in self.filtros)]

        if self.operacion == "update":
            for fila in seleccion:
                fila.update(self.datos)
        elif self.operacion == "delete":
            self.bd.tablas[self.tabla] = [f for f in filas if f not in seleccion]

        if self.orden:
            columna, desc = self.orden
            seleccion.sort(key=lambda f: str(f.get(columna)), reverse=desc)
        total = len(seleccion)
        if self.rango is not None:
            seleccion = seleccion[self.rango[0] : self.rango[1] + 1]
        if self.limite is not None:
            seleccion = seleccion[: self.limite]
        return SimpleNamespace(data=copy.deepcopy(seleccion), count=total if self.contar else None)


class FakeRpc:
    """Funciones de la base. Solo se simula lo mínimo de cerrar_analisis_lote: la lógica real
    (grado, porcentajes) vive en la base de datos y no se repite aquí."""

    def __init__(self, bd: FakeSupabase, nombre: str, parametros: dict) -> None:
        self.bd, self.nombre, self.parametros = bd, nombre, parametros

    def execute(self) -> SimpleNamespace:
        self.bd.rpc_llamadas.append((self.nombre, self.parametros))
        if self.nombre in self.bd.fallar_rpc:
            raise APIError({"code": "XX000", "message": "fallo simulado"})
        if self.nombre != "cerrar_analisis_lote":
            raise AssertionError(f"rpc no simulada: {self.nombre}")
        lote_id = self.parametros["p_lote_id"]
        frutos = [f for f in self.bd.tablas.get("frutos", []) if f["lote_id"] == lote_id]
        analisis = self.bd.completar("analisis_lote", {
            "lote_id": lote_id, "total_frutos": len(frutos), "frutos_sanos": 0, "frutos_separar": 0,
            "frutos_revision": len(frutos), "pct_sanos": None, "pct_separar": None, "conteo_por_clase": {},
            "grado": None, "destino_lote": None, "muestra_pequena": True,
            "modelo_version": self.parametros["p_modelo_version"],
        })
        self.bd.tablas.setdefault("analisis_lote", []).append(analisis)
        for lote in self.bd.tablas["lotes"]:
            if lote["id"] == lote_id:
                lote["estado"] = "analizado"
        return SimpleNamespace(data=copy.deepcopy(analisis))


class FakeStorage:
    """Bucket en memoria. Con usuario_id imita la política: solo su carpeta."""

    def __init__(self, usuario_id: str | None) -> None:
        self.usuario_id = usuario_id
        self.objetos: dict[str, tuple[bytes, dict]] = {}
        # Número de subidas que salen bien antes de fallar a propósito.
        self.fallar_despues_de: int | None = None
        self.subidas = 0

    def from_(self, bucket: str) -> "FakeBucket":
        assert bucket == "fotos-lotes", bucket
        return FakeBucket(self)


class FakeBucket:
    def __init__(self, storage: FakeStorage) -> None:
        self.storage = storage

    def _permitida(self, ruta: str) -> bool:
        return self.storage.usuario_id is None or ruta.split("/")[0] == self.storage.usuario_id

    def upload(self, ruta: str, contenido: bytes, opciones: dict | None = None) -> None:
        if self.storage.fallar_despues_de is not None and self.storage.subidas >= self.storage.fallar_despues_de:
            raise StorageException("fallo simulado")
        if not self._permitida(ruta):
            raise StorageException("new row violates row-level security policy")
        if ruta in self.storage.objetos:
            raise StorageException("The resource already exists")
        self.storage.objetos[ruta] = (contenido, opciones or {})
        self.storage.subidas += 1

    def download(self, ruta: str) -> bytes:
        if ruta not in self.storage.objetos or not self._permitida(ruta):
            raise StorageException("Object not found")
        return self.storage.objetos[ruta][0]

    def remove(self, rutas: list[str]) -> list[dict]:
        borradas = [r for r in rutas if r in self.storage.objetos and self._permitida(r)]
        for ruta in borradas:
            del self.storage.objetos[ruta]
        return [{"name": ruta} for ruta in borradas]

    def create_signed_urls(self, rutas: list[str], expira: int, opciones: dict | None = None) -> list[dict]:
        respuesta = []
        for ruta in rutas:
            existe = ruta in self.storage.objetos and self._permitida(ruta)
            url = f"https://storage.test/{ruta}?expira={expira}" if existe else None
            error = None if existe else "Either the object does not exist or you do not have access to it"
            respuesta.append({"path": ruta, "signedURL": url, "signedUrl": url, "error": error})
        return respuesta
