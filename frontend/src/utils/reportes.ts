import { DESTINOS, GRADOS, NOMBRE_DESTINO, NOMBRE_ESTADO, NOMBRE_FRUTA, NOMBRE_GRADO, type Grado, type LoteReporte } from './dominio'

export const rutaLote = (id: string) => `/reportes/lote/${encodeURIComponent(id)}`

/* ---------- Filtros guardados en la URL ---------- */

export type Columna = 'lote' | 'cosecha' | 'cultivo' | 'parcela' | 'frutos' | 'sanos' | 'separar' | 'grado'
export type Direccion = 'asc' | 'desc'
export type VistaLista = 'tabla' | 'tarjetas'

export type Filtros = {
  q: string
  cultivos: string[]
  zona: string
  desde: string
  hasta: string
  grados: Grado[]
  orden: Columna
  dir: Direccion
}

const COLUMNAS: readonly Columna[] = ['lote', 'cosecha', 'cultivo', 'parcela', 'frutos', 'sanos', 'separar', 'grado']
const ORDEN_INICIAL: Pick<Filtros, 'orden' | 'dir'> = { orden: 'cosecha', dir: 'desc' }

const lista = (valor: string | null) => (valor ? valor.split(',').filter(Boolean) : [])

export function leerFiltros(params: URLSearchParams): Filtros {
  const orden = params.get('orden') as Columna | null
  return {
    q: params.get('q') ?? '',
    cultivos: lista(params.get('cultivo')),
    zona: params.get('zona') ?? '',
    desde: params.get('desde') ?? '',
    hasta: params.get('hasta') ?? '',
    grados: lista(params.get('grado')).filter((g): g is Grado => GRADOS.includes(g as Grado)),
    orden: orden && COLUMNAS.includes(orden) ? orden : ORDEN_INICIAL.orden,
    dir: params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : ORDEN_INICIAL.dir,
  }
}

/** Query string con solo lo que no está en su valor inicial (URLs cortas). */
export function escribirFiltros(filtros: Filtros, vista: VistaLista | null): string {
  const params = new URLSearchParams()
  // Sin recortar: el espacio entre palabras se escribe letra por letra
  if (filtros.q.trim()) params.set('q', filtros.q)
  if (filtros.cultivos.length) params.set('cultivo', filtros.cultivos.join(','))
  if (filtros.zona) params.set('zona', filtros.zona)
  if (filtros.desde) params.set('desde', filtros.desde)
  if (filtros.hasta) params.set('hasta', filtros.hasta)
  if (filtros.grados.length) params.set('grado', filtros.grados.join(','))
  if (filtros.orden !== ORDEN_INICIAL.orden || filtros.dir !== ORDEN_INICIAL.dir) {
    params.set('orden', filtros.orden)
    params.set('dir', filtros.dir)
  }
  if (vista) params.set('vista', vista)
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/** Filtros activos (el orden no cuenta como filtro). */
export function contarFiltros(f: Filtros): number {
  return (f.q.trim() ? 1 : 0) + f.cultivos.length + (f.zona ? 1 : 0) + (f.desde ? 1 : 0) + (f.hasta ? 1 : 0) + f.grados.length
}

export function sinFiltros(f: Filtros): Filtros {
  return { ...f, q: '', cultivos: [], zona: '', desde: '', hasta: '', grados: [] }
}

/* ---------- Opciones de los filtros: salen de los datos, no de listas fijas ---------- */

export function opcionesFiltros(lotes: readonly LoteReporte[]) {
  const cultivos = [...new Set(lotes.map((l) => l.fruta_principal).filter((c): c is string => Boolean(c)))]
  const zonas = new Map<string, string>()
  for (const l of lotes) if (l.zona_id !== null) zonas.set(String(l.zona_id), l.zona_nombre ?? `Zona ${l.zona_id}`)
  const grados = GRADOS.filter((g) => lotes.some((l) => l.grado === g))
  return {
    cultivos: cultivos.sort((a, b) => nombreCultivo(a).localeCompare(nombreCultivo(b), 'es')),
    zonas: [...zonas].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    grados,
  }
}

export const nombreCultivo = (codigo: string | null) => (codigo ? (NOMBRE_FRUTA[codigo] ?? codigo) : 'Sin cultivo')

/** Quita acentos y mayúsculas para que "jose" encuentre "San José". */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Fecha que ordena y agrupa la lista: la cosecha; si falta, el día en que se creó el lote. */
export const fechaLote = (l: LoteReporte) => l.fecha_cosecha ?? l.created_at?.slice(0, 10) ?? ''

export function filtrarLotes(lotes: readonly LoteReporte[], f: Filtros): LoteReporte[] {
  const q = normalizar(f.q.trim())
  return lotes.filter((l) => {
    if (q && !normalizar(`${l.nombre ?? ''} ${l.parcela ?? ''} ${l.id}`).includes(q)) return false
    if (f.cultivos.length && !f.cultivos.includes(l.fruta_principal ?? '')) return false
    if (f.zona && String(l.zona_id) !== f.zona) return false
    if (f.desde && fechaLote(l) < f.desde) return false
    if (f.hasta && fechaLote(l) > f.hasta) return false
    if (f.grados.length && (!l.grado || !f.grados.includes(l.grado))) return false
    return true
  })
}

/* ---------- Orden ---------- */

function valorOrden(l: LoteReporte, columna: Columna): string | number | null {
  switch (columna) {
    case 'lote':
      return l.nombre
    case 'cosecha':
      return fechaLote(l)
    case 'cultivo':
      return nombreCultivo(l.fruta_principal)
    case 'parcela':
      return l.parcela ?? l.zona_nombre
    case 'frutos':
      return l.total_frutos
    case 'sanos':
      return l.pct_sanos
    case 'separar':
      return l.pct_separar
    case 'grado':
      return l.grado ? GRADOS.indexOf(l.grado) : null
  }
}

export function ordenarLotes(lotes: LoteReporte[], columna: Columna, dir: Direccion): LoteReporte[] {
  const signo = dir === 'asc' ? 1 : -1
  return [...lotes].sort((a, b) => {
    const va = valorOrden(a, columna)
    const vb = valorOrden(b, columna)
    // Sin dato (lote sin analizar) siempre al final, sin importar la dirección
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    const comparacion = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true })
    // Desempate estable: lo más reciente primero
    return comparacion * signo || (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
}

/* ---------- Grupos por fecha: Hoy, Esta semana, Antes ---------- */

export type Grupo = { id: 'hoy' | 'semana' | 'antes'; titulo: string; lotes: LoteReporte[] }

function diaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

export function agruparPorFecha(lotes: readonly LoteReporte[], hoy = new Date()): Grupo[] {
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)) // la semana empieza en lunes
  const diaHoy = diaLocal(hoy)
  const diaLunes = diaLocal(lunes)

  const grupos: Grupo[] = [
    { id: 'hoy', titulo: 'Hoy', lotes: [] },
    { id: 'semana', titulo: 'Esta semana', lotes: [] },
    { id: 'antes', titulo: 'Antes', lotes: [] },
  ]
  for (const lote of lotes) {
    const dia = fechaLote(lote)
    grupos[dia >= diaHoy ? 0 : dia >= diaLunes ? 1 : 2].lotes.push(lote)
  }
  return grupos.filter((g) => g.lotes.length)
}

/* ---------- Exportar ---------- */

const celda = (valor: string | number | null | undefined) => {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

/** CSV que Excel abre directo (BOM para que respete acentos). */
export function descargarExcel(lotes: readonly LoteReporte[], nombreArchivo: string) {
  const encabezado = [
    'Lote', 'ID', 'Fecha de cosecha', 'Cultivo', 'Parcela', 'Zona', 'Estado', 'Frutos clasificados',
    'En revisión manual', '% sanos', '% para separar', 'Grado', 'Destino del lote',
    ...DESTINOS.map((d) => `Frutos: ${d.nombre}`),
  ]
  const filas = lotes.map((l) => [
    l.nombre, l.id, l.fecha_cosecha, nombreCultivo(l.fruta_principal), l.parcela, l.zona_nombre,
    l.estado ? NOMBRE_ESTADO[l.estado] : '', l.total_frutos, l.frutos_revision, l.pct_sanos, l.pct_separar,
    l.grado ? NOMBRE_GRADO[l.grado] : '', l.destino_lote ? NOMBRE_DESTINO[l.destino_lote] : '',
    ...DESTINOS.map((d) => l.frutos_por_destino?.[d.codigo] ?? ''),
  ])
  const csv = [encabezado, ...filas].map((fila) => fila.map(celda).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const enlace = Object.assign(document.createElement('a'), { href: url, download: `${nombreArchivo}.csv` })
  enlace.click()
  URL.revokeObjectURL(url)
}
