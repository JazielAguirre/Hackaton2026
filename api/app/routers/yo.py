from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import UsuarioActual

router = APIRouter(tags=["sesión"])


class Yo(BaseModel):
    id: UUID
    email: str | None


@router.get("/yo", response_model=Yo, summary="Usuario de la sesión actual")
def yo(usuario: UsuarioActual) -> Yo:
    """Sirve para que la web compruebe que su token es válido para la API."""
    return Yo(id=usuario.id, email=usuario.email)
