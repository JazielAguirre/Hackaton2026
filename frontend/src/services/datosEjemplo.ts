/*
 * DATOS DE EJEMPLO para diseñar la pantalla principal.
 * Se reemplazan por consultas a Supabase (vista bitacora_lotes, función
 * alertas_comunitarias y conteo de frutos por destino) cuando se conecte el backend.
 * Los grados respetan los umbrales de CLAUDE.md.
 */
import type { AlertaComunitaria, Destino, LoteBitacora } from '../utils/dominio'

const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

function lote(datos: Partial<LoteBitacora>): LoteBitacora {
  return {
    analisis_id: null,
    analizado_at: null,
    conteo_por_clase: null,
    created_at: null,
    destino_buscado: null,
    destino_lote: null,
    estado: 'analizado',
    fecha_cosecha: null,
    fruta_principal: null,
    frutos_revision: 0,
    frutos_sanos: 0,
    frutos_separar: 0,
    grado: null,
    id: null,
    latitud: null,
    longitud: null,
    modelo_version: null,
    muestra_pequena: false,
    nombre: null,
    parcela: null,
    pct_sanos: null,
    pct_separar: null,
    total_frutos: 0,
    updated_at: null,
    usuario_id: null,
    zona_id: 1,
    zona_nombre: 'Zona Centro',
    ...datos,
  }
}

export const lotesEjemplo: LoteBitacora[] = [
  lote({ id: 'l-08', nombre: 'Lote 08', parcela: 'El Mirador', fruta_principal: 'mango', analizado_at: diasAtras(0), total_frutos: 64, frutos_sanos: 62, frutos_separar: 0, frutos_revision: 1, pct_sanos: 98.4, pct_separar: 0, grado: 'A', destino_lote: 'exportacion' }),
  lote({ id: 'l-07', nombre: 'Lote 07', parcela: 'La Huerta', fruta_principal: 'jitomate', analizado_at: diasAtras(1), total_frutos: 48, frutos_sanos: 42, frutos_separar: 0, frutos_revision: 2, pct_sanos: 91.3, pct_separar: 0, grado: 'B', destino_lote: 'mercado_nacional' }),
  lote({ id: 'l-06', nombre: 'Lote 06', parcela: 'El Mirador', fruta_principal: 'mango', analizado_at: diasAtras(2), total_frutos: 55, frutos_sanos: 38, frutos_separar: 6, frutos_revision: 3, pct_sanos: 73.1, pct_separar: 11.5, grado: 'rechazo', destino_lote: 'separar' }),
  lote({ id: 'l-05', nombre: 'Lote 05', parcela: 'Los Fresnos', fruta_principal: 'fresa', analizado_at: diasAtras(3), total_frutos: 72, frutos_sanos: 58, frutos_separar: 3, frutos_revision: 2, pct_sanos: 82.9, pct_separar: 4.3, grado: 'C', destino_lote: 'procesamiento', zona_id: 2, zona_nombre: 'Zona Norte' }),
  lote({ id: 'l-04', nombre: 'Lote 04', parcela: 'La Huerta', fruta_principal: 'jitomate', analizado_at: diasAtras(4), total_frutos: 40, frutos_sanos: 39, frutos_separar: 0, frutos_revision: 0, pct_sanos: 97.5, pct_separar: 0, grado: 'A', destino_lote: 'exportacion' }),
  lote({ id: 'l-03', nombre: 'Lote 03', parcela: 'El Mirador', fruta_principal: 'mango', analizado_at: diasAtras(6), total_frutos: 31, frutos_sanos: 28, frutos_separar: 0, frutos_revision: 1, pct_sanos: 93.3, pct_separar: 0, grado: 'B', destino_lote: 'mercado_nacional' }),
  lote({ id: 'l-02', nombre: 'Lote 02', parcela: 'Los Fresnos', fruta_principal: 'fresa', analizado_at: diasAtras(8), total_frutos: 22, frutos_sanos: 21, frutos_separar: 0, frutos_revision: 0, pct_sanos: 95.5, pct_separar: 0, grado: 'A', destino_lote: 'exportacion', muestra_pequena: true, zona_id: 2, zona_nombre: 'Zona Norte' }),
  lote({ id: 'l-01', nombre: 'Lote 01', parcela: 'La Huerta', fruta_principal: 'jitomate', estado: 'analizando', analizado_at: null, created_at: diasAtras(0) }),
]

/** Frutos por destino en los lotes analizados (el destino lo asigna el trigger de la BD). */
export const frutosPorDestinoEjemplo: Record<Destino, number> = {
  exportacion: 288,
  mercado_nacional: 18,
  procesamiento: 8,
  separar: 9,
  revision_manual: 9,
}

export const alertasEjemplo: AlertaComunitaria[] = [
  { zona_id: 1, zona_nombre: 'Zona Centro', fruta_id: 'mango', clase_codigo: 'antracnosis', lotes_afectados: 4, ultimo_reporte: diasAtras(1) },
  { zona_id: 2, zona_nombre: 'Zona Norte', fruta_id: 'fresa', clase_codigo: 'moho_gris', lotes_afectados: 3, ultimo_reporte: diasAtras(3) },
]
