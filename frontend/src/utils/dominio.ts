import type { Database, Tables } from '../types/database'

// Tipos de dominio tomados de la base de datos (frontend/src/types/database.ts)
export type Destino = Database['public']['Enums']['destino']
export type Grado = Database['public']['Enums']['grado_lote']
export type LoteBitacora = Tables<'bitacora_lotes'>
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

const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const numero = new Intl.NumberFormat('es-MX')

export function formatFecha(iso: string | null): string {
  return iso ? fechaCorta.format(new Date(iso)) : '—'
}

export function formatNumero(valor: number): string {
  return numero.format(valor)
}

export function formatPct(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor)} %`
}
