import {
  CLASES_SANAS,
  DESTINOS,
  GRADOS,
  type AlertaComunitaria,
  type Destino,
  type Grado,
  type LoteReporte,
  type Zona,
} from './dominio'

export const rutaZona = (id: number) => `/zonas/${id}`

export type ResumenZona = {
  zona: Zona
  /** Todos los lotes de la zona (también los que siguen en análisis) */
  lotes: LoteReporte[]
  analizados: number
  frutosClasificados: number
  /** Ponderado por frutos: el lote grande pesa más que el chico (igual que la BD calcula cada lote) */
  pctSanos: number | null
  pctSeparar: number | null
  porGrado: Record<Grado, number>
  porDestino: Record<Destino, number>
  /** Defectos más frecuentes en la zona: { codigo, n } de mayor a menor */
  defectos: { codigo: string; fruta: string; n: number }[]
  alertas: AlertaComunitaria[]
  ultimoAnalisis: string | null
}

/**
 * Junta lo que ya calculó la base de datos por lote (bitacora_lotes) para una zona.
 * Solo suma; no vuelve a clasificar ni a asignar grados.
 */
export function resumirZona(zona: Zona, lotes: readonly LoteReporte[], alertas: readonly AlertaComunitaria[]): ResumenZona {
  const deZona = lotes.filter((l) => l.zona_id === zona.id)
  const analizados = deZona.filter((l) => l.estado === 'analizado' && l.analisis_id !== null)

  const porGrado = Object.fromEntries(GRADOS.map((g) => [g, 0])) as Record<Grado, number>
  const porDestino = Object.fromEntries(DESTINOS.map((d) => [d.codigo, 0])) as Record<Destino, number>
  const conteoDefectos = new Map<string, { codigo: string; fruta: string; n: number }>()
  let frutos = 0
  let sanos = 0
  let separar = 0
  let ultimo: string | null = null

  for (const l of analizados) {
    if (l.grado) porGrado[l.grado] += 1
    frutos += l.total_frutos ?? 0
    sanos += l.frutos_sanos ?? 0
    separar += l.frutos_separar ?? 0
    for (const d of DESTINOS) porDestino[d.codigo] += l.frutos_por_destino?.[d.codigo] ?? 0
    if (l.analizado_at && (!ultimo || l.analizado_at > ultimo)) ultimo = l.analizado_at

    // conteo_por_clase: { "mango": { "sano": 10, "antracnosis": 2 } }
    const conteo = (l.conteo_por_clase ?? {}) as Record<string, Record<string, number>>
    for (const [fruta, clases] of Object.entries(conteo)) {
      for (const [codigo, n] of Object.entries(clases)) {
        if (CLASES_SANAS.has(codigo) || !n) continue
        const clave = `${fruta}:${codigo}`
        const actual = conteoDefectos.get(clave) ?? { codigo, fruta, n: 0 }
        actual.n += n
        conteoDefectos.set(clave, actual)
      }
    }
  }

  return {
    zona,
    lotes: deZona,
    analizados: analizados.length,
    frutosClasificados: frutos,
    pctSanos: frutos ? (100 * sanos) / frutos : null,
    pctSeparar: frutos ? (100 * separar) / frutos : null,
    porGrado,
    porDestino,
    defectos: [...conteoDefectos.values()].sort((a, b) => b.n - a.n),
    alertas: alertas.filter((a) => a.zona_id === zona.id),
    ultimoAnalisis: ultimo,
  }
}

/** Valida los datos de una zona nueva. Devuelve un mensaje por campo con error. */
export function validarZona(
  datos: { nombre: string; latitud: string; longitud: string },
  existentes: readonly Zona[],
): Partial<Record<'nombre' | 'latitud' | 'longitud', string>> {
  const errores: Partial<Record<'nombre' | 'latitud' | 'longitud', string>> = {}
  const nombre = datos.nombre.trim()
  const normal = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (!nombre) errores.nombre = 'Escribe el nombre de la zona.'
  else if (nombre.length > 80) errores.nombre = 'Usa máximo 80 caracteres.'
  else if (existentes.some((z) => normal(z.nombre) === normal(nombre))) errores.nombre = 'Ya existe una zona con ese nombre.'

  const revisar = (campo: 'latitud' | 'longitud', limite: number) => {
    const texto = datos[campo].trim()
    if (!texto) return
    const valor = Number(texto)
    if (!Number.isFinite(valor) || Math.abs(valor) > limite) errores[campo] = `Debe ser un número entre -${limite} y ${limite}.`
  }
  revisar('latitud', 90)
  revisar('longitud', 180)
  // Las coordenadas van juntas: una sola no sirve para ubicar la zona
  if (!errores.latitud && !errores.longitud && Boolean(datos.latitud.trim()) !== Boolean(datos.longitud.trim())) {
    errores[datos.latitud.trim() ? 'longitud' : 'latitud'] = 'Escribe latitud y longitud, o deja las dos vacías.'
  }
  return errores
}
