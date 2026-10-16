from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errores import registrar_manejadores
from app.routers import analisis, bitacora, fotos, health, lotes, reporte, yo, zonas

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
app.include_router(fotos.router)
app.include_router(analisis.router)
app.include_router(bitacora.router)
app.include_router(reporte.router)
app.include_router(zonas.router)
