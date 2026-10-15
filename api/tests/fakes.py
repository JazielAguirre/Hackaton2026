"""Dobles de prueba de Supabase para no depender de la red ni de claves reales."""

from types import SimpleNamespace

from supabase_auth.errors import AuthApiError


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
