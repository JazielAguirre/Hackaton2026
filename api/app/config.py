from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    # Separados por coma en CORS_ORIGINS. Por defecto, el servidor de Vite con ambos nombres.
    # Servicio de inferencia (inferencia/ en docker-compose.yml).
    inferencia_url: str = "http://127.0.0.1:8001"
    # Un lote en `analizando` desde hace más de esto se considera caído y se puede reintentar.
    analisis_vencido_minutos: int = 10
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
