import type { Database, Tables } from '../types/database'

// Tipos de dominio tomados de la base de datos (frontend/src/types/database.ts)
export type Destino = Database['public']['Enums']['destino']
export type Grado = Database['public']['Enums']['grado_lote']
export type LoteBitacora = Tables<'bitacora_lotes'>
export type Zona = Tables<'zonas'>
export type AlertaComunitaria = Database['public']['Functions']['alertas_comunitarias']['Returns'][number]

/** Orden fijo de destinos y su color (CLAUDE.md: verde, amarillo, naranja, rojo, gris). */
export const DESTINOS: readonly { codigo: Destino; nombre: string }[] = [
  { codigo: 'exportacion', nombre: 'Exportación' },
  { codigo: 'mercado_nacional', nombre: 'Mercado nacional' },
  { codigo: 'procesamiento', nombre: 'Procesamiento' },
  { codigo: 'separar', nombre: 'Separar' },
  { codigo: 'revision_manual', nombre: 'Revisión manual' },
]

export const GRADOS: readonly Grado[] = ['A', 'B', 'C', 'rechazo']

export const NOMBRE_GRADO: Record<Grado, string> = {
  A: 'Grado A',
  B: 'Grado B',
  C: 'Grado C',
  rechazo: 'Rechazo',
}

// Mismos nombres que las tablas frutas y clases
export const NOMBRE_FRUTA: Record<string, string> = {
  mango: 'Mango',
  jitomate: 'Jitomate',
  fresa: 'Fresa',
}

export const NOMBRE_CLASE: Record<string, string> = {
  sano: 'Sano',
  sana: 'Sana',
  antracnosis: 'Antracnosis',
  pudricion_pedunculo: 'Pudrición del pedúnculo',
  otro_defecto: 'Otro defecto',
  pudricion_mancha: 'Pudrición o mancha',
  dano_fisico: 'Daño físico',
  moho_gris: 'Moho gris',
  oidio_fruto: 'Oídio en fruto',
}

/** Clases sanas (clases.es_sana). Todo lo demás cuenta como defecto. */
export const CLASES_SANAS: ReadonlySet<string> = new Set(['sano', 'sana'])

export const NOMBRE_ESTADO: Record<Database['public']['Enums']['estado_lote'], string> = {
  borrador: 'Sin analizar',
  analizando: 'Analizando…',
  analizado: 'Analizado',
  error: 'Error en el análisis',
}

/** Marca de cada destino: ✕ para separar y ? para revisión, para no depender solo del color. */
export const SIMBOLO_DESTINO: Partial<Record<Destino, string>> = { separar: '✕', revision_manual: '?' }

export const NOMBRE_DESTINO = Object.fromEntries(DESTINOS.map((d) => [d.codigo, d.nombre])) as Record<Destino, string>

/* ---------- Detalle de lote: misma forma que GET /lotes/{id} (api/app/schemas/lote.py) ---------- */

export type FotoDetalle = Tables<'fotos'> & {
  /** URL firmada de la foto original (vence en 1 hora). */
  url: string | null
  url_marcada: string | null
}

/** Caja normalizada de 0 a 1; se toma caja_x/caja_y como la esquina superior izquierda. */
export type FrutoDetalle = Omit<Tables<'frutos'>, 'clase_id' | 'lote_id' | 'created_at'> & {
  clase: { codigo: string; nombre: string } | null
}

export type AnalisisLote = Omit<Tables<'analisis_lote'>, 'lote_id' | 'conteo_por_clase'> & {
  /** { "mango": { "sano": 10, "antracnosis": 2 } }, sin contar revision_manual */
  conteo_por_clase: Record<string, Record<string, number>>
}

export type Sugerencia = Pick<Tables<'sugerencias'>, 'id' | 'ficha_id' | 'texto' | 'origen' | 'created_at'>

export type LoteDetalle = Tables<'lotes'> & {
  zona_nombre: string | null
  fotos: FotoDetalle[]
  analisis: AnalisisLote | null
  frutos: FrutoDetalle[]
  sugerencias: Sugerencia[]
}

/** Renglón de Reportes: la vista bitacora_lotes + frutos por destino (conteo de la tabla frutos). */
export type LoteReporte = LoteBitacora & {
  id: string
  frutos_por_destino: Record<Destino, number> | null
}

/* ---------- Formatos es-MX ---------- */

const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const hora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' })
const numero = new Intl.NumberFormat('es-MX')

export function formatFecha(iso: string | null): string {
  return iso ? fechaCorta.format(new Date(iso)) : '—'
}

/** "10 oct 2026". Las fechas sin hora (fecha_cosecha) se leen como día local, no UTC. */
export function formatFechaLarga(valor: string | null): string {
  if (!valor) return '—'
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00`) : new Date(valor)
  return fechaLarga.format(fecha).replace('.', '')
}

/** "10 oct 2026, 14:05" */
export function formatFechaHora(iso: string | null): string {
  return iso ? `${formatFechaLarga(iso)}, ${hora.format(new Date(iso))}` : '—'
}

/** "120 frutos" / "1 fruto" */
export function formatFrutos(valor: number): string {
  return `${numero.format(valor)} ${valor === 1 ? 'fruto' : 'frutos'}`
}

export function formatNumero(valor: number): string {
  return numero.format(valor)
}

export function formatPct(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor)}%`
}
