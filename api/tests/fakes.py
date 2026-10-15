"""Dobles de prueba de Supabase para no depender de la red ni de claves reales."""

import copy
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Callable
from uuid import uuid4

from postgrest import APIError
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

    def table(self, nombre: str) -> "FakeQuery":
        return FakeQuery(self, nombre)

    def visible(self, tabla: str, fila: dict) -> bool:
        if self.usuario_id is None:
            return True
        if tabla == "lotes":
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
        fila.setdefault("id", str(uuid4()))
        fila.setdefault("created_at", ahora)
        if tabla == "lotes":
            fila.setdefault("usuario_id", self.usuario_id)
            fila.setdefault("estado", "borrador")
            fila.setdefault("updated_at", ahora)
        if tabla == "fotos":
            for campo, valor in {"valida": True, "motivo_rechazo": None, "nitidez": None, "brillo": None}.items():
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

    def select(self, *_columnas: str, **_opciones: Any) -> "FakeQuery":
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

    def execute(self) -> SimpleNamespace:
        filas = self.bd.tablas.setdefault(self.tabla, [])

        if self.operacion == "insert":
            nuevas = self.datos if isinstance(self.datos, list) else [self.datos]
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
        if self.limite is not None:
            seleccion = seleccion[: self.limite]
        return SimpleNamespace(data=copy.deepcopy(seleccion))
