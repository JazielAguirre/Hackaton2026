import type { LoteDetalle, LoteReporte, Zona, AlertaComunitaria } from '../utils/dominio'
import type { NuevaZona } from '../components/zonas/RegistrarZona'
import { apiGet, apiPost, apiPostForm } from './api'
import { supabase } from './supabase'

/* Lecturas y escrituras de la app. Lo que la API calcula (grado, destinos) llega ya hecho: aquí no se recalcula. */

type PaginaBitacora = { total: number; lotes: LoteReporte[] }
const POR_PAGINA = 100

/** Todos los lotes del usuario, del más nuevo al más antiguo (GET /bitacora, pidiendo página por página). */
export async function leerBitacora(): Promise<LoteReporte[]> {
  const lotes: LoteReporte[] = []
  for (;;) {
    const pagina = await apiGet<PaginaBitacora>(`/bitacora?limite=${POR_PAGINA}&desplazamiento=${lotes.length}`)
    lotes.push(...pagina.lotes)
    if (lotes.length >= pagina.total || pagina.lotes.length === 0) return lotes
  }
}

export const leerLote = (id: string) => apiGet<LoteDetalle>(`/lotes/${encodeURIComponent(id)}`)

export async function leerZonas(): Promise<Zona[]> {
  const { data, error } = await supabase.from('zonas').select('*').order('nombre')
  if (error) throw new Error('No pudimos leer las zonas.')
  return data
}

/** Alertas de toda la comunidad (la función agrega lotes de todos los usuarios, sin datos personales). */
export async function leerAlertas(): Promise<AlertaComunitaria[]> {
  const { data, error } = await supabase.rpc('alertas_comunitarias')
  if (error) throw new Error('No pudimos leer las alertas de zona.')
  return data
}

/** Solo acopio y técnico pueden; a un productor la API le responde 403 con su mensaje. */
export const crearZona = (zona: NuevaZona) => apiPost<Zona>('/zonas', zona)

export type Parcela = { id: string; nombre: string }

/** Parcelas activas del usuario (RLS solo deja ver las suyas). */
export async function leerParcelas(): Promise<Parcela[]> {
  const { data, error } = await supabase.from('parcelas').select('id, nombre').eq('activa', true).order('nombre')
  if (error) throw new Error('No pudimos leer tus parcelas.')
  return data
}

type NuevoLoteApi = { nombre: string; fecha_cosecha: string; parcela_id?: string }

/**
 * Crea el lote, sube sus fotos e inicia el análisis (que sigue en segundo plano).
 * Devuelve el id del lote para abrir su detalle.
 */
export async function enviarLote(datos: NuevoLoteApi, fotos: File[]): Promise<string> {
  const { id } = await apiPost<{ id: string }>('/lotes', datos)

  try {
    const formulario = new FormData()
    for (const foto of fotos) formulario.append('fotos', foto)
    await apiPostForm(`/lotes/${id}/fotos`, formulario)
  } catch (error) {
    // Sin fotos el lote no sirve: se quita para no dejar un "Sin analizar" vacío en Reportes.
    await supabase.from('lotes').delete().eq('id', id)
    throw error
  }

  try {
    await apiPost(`/lotes/${id}/analizar`)
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Intenta de nuevo.'
    throw new Error(`Se guardaron las fotos, pero no pudimos iniciar el análisis. ${motivo}`)
  }
  return id
}
