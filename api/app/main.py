from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errores import registrar_manejadores
from app.routers import health, lotes, yo

app = FastAPI(
    title="FruitScan API",
    description="Preclasificación visual de fruta por lote. No es una certificación de exportación.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

registrar_manejadores(app)

app.include_router(health.router)
app.include_router(yo.router)
app.include_router(lotes.router)
