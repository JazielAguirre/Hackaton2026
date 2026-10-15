from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, ClientOptions, create_client
from supabase_auth.errors import AuthApiError, AuthError

from app.config import get_settings

SESION_INVALIDA = "Tu sesión no es válida o expiró; vuelve a iniciar sesión"

bearer = HTTPBearer(auto_error=False, description="access_token de Supabase Auth")


@dataclass(frozen=True)
class Usuario:
    id: UUID
    email: str | None
    token: str


def _opciones(token: str | None = None) -> ClientOptions:
    # La API no guarda sesiones: solo reenvía el token que manda la web.
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return ClientOptions(headers=headers, auto_refresh_token=False, persist_session=False)


@lru_cache
def cliente_admin() -> Client:
    """Service role: se salta RLS. Solo para lo que el usuario no puede escribir
    (frutos, analisis_lote, sugerencias) y para el trabajo en segundo plano."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key, options=_opciones())


@lru_cache
def cliente_anon() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key, options=_opciones())


def _no_autorizado(mensaje: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=mensaje,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _servicio_no_disponible() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No se pudo verificar tu sesión; intenta de nuevo en un momento",
    )


def usuario_actual(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    anon: Annotated[Client, Depends(cliente_anon)],
) -> Usuario:
    if credenciales is None:
        raise _no_autorizado("Inicia sesión para continuar")

    try:
        respuesta = anon.auth.get_user(credenciales.credentials)
    except AuthApiError as error:
        if error.status >= 500:
            raise _servicio_no_disponible() from error
        raise _no_autorizado(SESION_INVALIDA) from error
    except AuthError as error:
        # Errores de red o respuestas inesperadas: no es culpa del token.
        raise _servicio_no_disponible() from error

    if respuesta is None or respuesta.user is None:
        raise _no_autorizado(SESION_INVALIDA)

    return Usuario(
        id=UUID(respuesta.user.id),
        email=respuesta.user.email,
        token=credenciales.credentials,
    )


def cliente_usuario(usuario: Annotated[Usuario, Depends(usuario_actual)]) -> Client:
    """Cliente con el JWT del usuario: PostgREST y Storage aplican RLS igual que en la web."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key, options=_opciones(usuario.token))


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
ClienteUsuario = Annotated[Client, Depends(cliente_usuario)]
ClienteAdmin = Annotated[Client, Depends(cliente_admin)]
