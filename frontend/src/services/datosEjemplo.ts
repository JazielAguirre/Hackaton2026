/*
 * DATOS DE EJEMPLO para diseñar las pantallas.
 * Tienen la misma forma que la vista bitacora_lotes y que GET /lotes/{id}
 * (api/app/schemas/lote.py). Se reemplazan por esas consultas cuando se conecte el backend.
 *
 * Aquí se SIMULA lo que hace la base de datos (trigger de destino y cerrar_analisis_lote)
 * solo para que los números de ejemplo sean coherentes. La app real no repite esa lógica.
 */
import {
  CLASES_SANAS,
  DESTINOS,
  NOMBRE_CLASE,
  type AlertaComunitaria,
  type AnalisisLote,
  type Destino,
  type FotoDetalle,
  type FrutoDetalle,
  type Grado,
  type LoteBitacora,
  type LoteDetalle,
  type LoteReporte,
  type Sugerencia,
} from '../utils/dominio'

const DIA = 86_400_000

/** Fecha ISO de hace `dias` días a una hora fija del día (horas locales). */
function haceDias(dias: number, horas = 9, minutos = 0): string {
  const fecha = new Date(Date.now() - dias * DIA)
  fecha.setHours(horas, minutos, 0, 0)
  return fecha.toISOString()
}

/** AAAA-MM-DD local (fecha_cosecha es tipo date). */
function fechaDia(dias: number): string {
  const fecha = new Date(Date.now() - dias * DIA)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

// Simulación de clases.destino_default (en la app real lo asigna el trigger de frutos)
const DESTINO_CLASE: Record<string, Record<string, Destino>> = {
  mango: { sano: 'exportacion', antracnosis: 'separar', pudricion_pedunculo: 'separar', otro_defecto: 'mercado_nacional' },
  jitomate: { sano: 'exportacion', pudricion_mancha: 'separar', dano_fisico: 'procesamiento' },
  fresa: { sana: 'exportacion', moho_gris: 'separar', antracnosis: 'separar', oidio_fruto: 'procesamiento' },
}

// Simulación de umbrales_grado (A, B, C) → destino del lote
const UMBRALES: readonly { grado: Grado; min: number; max: number; destino: Destino }[] = [
  { grado: 'A', min: 95, max: 0, destino: 'exportacion' },
  { grado: 'B', min: 85, max: 2, destino: 'mercado_nacional' },
  { grado: 'C', min: 70, max: 5, destino: 'procesamiento' },
]

type Zona = { id: number; nombre: string }
const ZONA_CENTRO: Zona = { id: 1, nombre: 'Zona Centro' }
const ZONA_NORTE: Zona = { id: 2, nombre: 'Zona Norte' }
const ZONA_SUR: Zona = { id: 3, nombre: 'Zona Sur' }

type LoteSpec = {
  id: string
  nombre: string
  fruta: 'mango' | 'jitomate' | 'fresa'
  parcela: string | null
  zona: Zona
  /** Días desde la cosecha y desde el análisis */
  cosecha: number
  analisis: number
  hora: number
  estado?: 'analizado' | 'analizando' | 'borrador'
  /** Frutos clasificados por clase; `revision` son los que quedaron bajo el umbral de confianza */
  clases?: Record<string, number>
  revision?: number
  fotos: number
  coordenadas?: [number, number]
}

const SPECS: readonly LoteSpec[] = [
  { id: '8f2c41d7-3b9e-4a51-9c0e-1d7a5b3e8f20', nombre: 'Lote 18', fruta: 'jitomate', parcela: 'La Huerta', zona: ZONA_CENTRO, cosecha: 0, analisis: 0, hora: 11, estado: 'borrador', fotos: 0 },
  { id: 'c41e0b9a-6d2f-4e73-8a15-9b0c2d4e6f71', nombre: 'Lote 17', fruta: 'jitomate', parcela: 'La Huerta', zona: ZONA_CENTRO, cosecha: 0, analisis: 0, hora: 10, estado: 'analizando', fotos: 2 },
  { id: '2a9d7c35-1e4b-4f86-b0a3-7c5d1e9f2b46', nombre: 'Lote 16', fruta: 'mango', parcela: 'El Mirador', zona: ZONA_CENTRO, cosecha: 0, analisis: 0, hora: 8, clases: { sano: 62, otro_defecto: 2 }, revision: 1, fotos: 4, coordenadas: [20.6597, -103.3496] },
  { id: '7e3b1f80-9c2d-4a6e-85b4-2f1a0c9d7e53', nombre: 'Lote 15', fruta: 'jitomate', parcela: 'La Huerta', zona: ZONA_CENTRO, cosecha: 2, analisis: 1, hora: 16, clases: { sano: 42, dano_fisico: 4, pudricion_mancha: 0 }, revision: 2, fotos: 3 },
  { id: 'b05d6e2c-4f1a-4b97-a3c8-6e2d9f0b1a84', nombre: 'Lote 14', fruta: 'mango', parcela: 'El Mirador', zona: ZONA_CENTRO, cosecha: 2, analisis: 2, hora: 12, clases: { sano: 38, antracnosis: 5, pudricion_pedunculo: 1, otro_defecto: 8 }, revision: 3, fotos: 3, coordenadas: [20.6597, -103.3496] },
  { id: '5c8a2e91-7b3d-4c04-9e6f-3a1b8d5c2e07', nombre: 'Lote 13', fruta: 'fresa', parcela: 'Los Fresnos', zona: ZONA_NORTE, cosecha: 3, analisis: 3, hora: 9, clases: { sana: 58, moho_gris: 2, antracnosis: 1, oidio_fruto: 9 }, revision: 2, fotos: 4 },
  { id: 'e91f4a06-2c7d-4b38-8d5e-0f9a6c3b1d72', nombre: 'Lote 12', fruta: 'jitomate', parcela: 'La Huerta', zona: ZONA_CENTRO, cosecha: 4, analisis: 4, hora: 13, clases: { sano: 39, dano_fisico: 1 }, revision: 0, fotos: 2 },
  { id: '3d7b9e14-8a2c-4f65-b1d0-5e8c2a7f9b13', nombre: 'Lote 11', fruta: 'fresa', parcela: 'Las Palmas', zona: ZONA_SUR, cosecha: 5, analisis: 5, hora: 10, clases: { sana: 44, oidio_fruto: 3 }, revision: 1, fotos: 3 },
  { id: '9a0c5f37-6e1b-4d29-a7c4-8b3f0e2d6a95', nombre: 'Lote 10', fruta: 'mango', parcela: 'El Mirador', zona: ZONA_CENTRO, cosecha: 7, analisis: 6, hora: 15, clases: { sano: 28, otro_defecto: 2 }, revision: 1, fotos: 2 },
  { id: '61e8d2b4-0f7a-4c53-9b26-d4a1e8c7f304', nombre: 'Lote 09', fruta: 'fresa', parcela: 'Los Fresnos', zona: ZONA_NORTE, cosecha: 9, analisis: 8, hora: 11, clases: { sana: 21, oidio_fruto: 1 }, revision: 0, fotos: 2 },
  { id: 'f4b72c90-3d5e-4a18-86f9-1c0d7b4e2a69', nombre: 'Lote 08', fruta: 'mango', parcela: 'San José', zona: ZONA_SUR, cosecha: 11, analisis: 10, hora: 9, clases: { sano: 70, antracnosis: 3, otro_defecto: 7 }, revision: 2, fotos: 4 },
  { id: '0d6a3e58-b2c9-4f71-a4e3-7f2b9c1d8e46', nombre: 'Lote 07', fruta: 'jitomate', parcela: 'San José', zona: ZONA_SUR, cosecha: 13, analisis: 12, hora: 14, clases: { sano: 47, pudricion_mancha: 2, dano_fisico: 6 }, revision: 1, fotos: 3 },
  { id: 'a7c19f2e-5d8b-4e60-b3a7-2e9d4c6f0b18', nombre: 'Lote 06', fruta: 'fresa', parcela: 'Las Palmas', zona: ZONA_SUR, cosecha: 16, analisis: 15, hora: 10, clases: { sana: 33, moho_gris: 4, oidio_fruto: 5 }, revision: 2, fotos: 3 },
  { id: '4b2e8d61-9f0c-4a37-85d2-6c3a1f7e9d50', nombre: 'Lote 05', fruta: 'mango', parcela: 'El Mirador', zona: ZONA_CENTRO, cosecha: 20, analisis: 19, hora: 12, clases: { sano: 96, otro_defecto: 1 }, revision: 3, fotos: 5, coordenadas: [20.6597, -103.3496] },
]

/* ---------- Generador determinista (mismo resultado en cada carga) ---------- */

function semilla(texto: string): () => number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  // mulberry32
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ANCHO = 1200
const ALTO = 900
const COLUMNAS = 5
const FILAS = 4

const COLOR_FRUTA = {
  mango: { piel: '#f2a93b', sombra: '#d9782a', brillo: '#ffd27a' },
  jitomate: { piel: '#e0402f', sombra: '#a8261c', brillo: '#ff8a70' },
  fresa: { piel: '#d7263d', sombra: '#9c1328', brillo: '#ff6b7d' },
} as const

/** Dibuja la "foto" de una charola como SVG: un fruto por caja, con la marca de su defecto. */
function dibujarCharola(fruta: LoteSpec['fruta'], frutos: FrutoDetalle[], azar: () => number): string {
  const color = COLOR_FRUTA[fruta]
  const piezas = frutos.map((fruto) => {
    const cx = (fruto.caja_x + fruto.caja_ancho / 2) * ANCHO
    const cy = (fruto.caja_y + fruto.caja_alto / 2) * ALTO
    const rx = (fruto.caja_ancho * ANCHO) / 2.15
    const ry = (fruto.caja_alto * ALTO) / 2.15
    const giro = Math.round(azar() * 60 - 30)
    const codigo = fruto.clase?.codigo ?? ''
    let defecto = ''
    if (codigo === 'antracnosis' || codigo === 'pudricion_mancha' || codigo === 'pudricion_pedunculo') {
      const dx = codigo === 'pudricion_pedunculo' ? 0 : rx * 0.25
      const dy = codigo === 'pudricion_pedunculo' ? -ry * 0.55 : ry * 0.1
      defecto = `<ellipse cx="${dx}" cy="${dy}" rx="${rx * 0.32}" ry="${ry * 0.26}" fill="#3b2412" opacity=".85"/><ellipse cx="${-rx * 0.3}" cy="${ry * 0.35}" rx="${rx * 0.14}" ry="${ry * 0.11}" fill="#3b2412" opacity=".75"/>`
    } else if (codigo === 'moho_gris') {
      defecto = `<ellipse cx="${rx * 0.1}" cy="${ry * 0.15}" rx="${rx * 0.55}" ry="${ry * 0.45}" fill="#b8b4ad" opacity=".9"/>`
    } else if (codigo === 'oidio_fruto') {
      defecto = `<ellipse cx="${-rx * 0.15}" cy="${ry * 0.1}" rx="${rx * 0.5}" ry="${ry * 0.35}" fill="#f4f1ea" opacity=".75"/>`
    } else if (codigo === 'dano_fisico') {
      defecto = `<path d="M${-rx * 0.5} ${-ry * 0.1} L${rx * 0.4} ${ry * 0.3}" stroke="#5a1a10" stroke-width="5" stroke-linecap="round"/>`
    } else if (codigo === 'otro_defecto') {
      defecto = `<ellipse cx="${rx * 0.3}" cy="${-ry * 0.2}" rx="${rx * 0.22}" ry="${ry * 0.18}" fill="#7a5a1e" opacity=".6"/>`
    }
    const semillas =
      fruta === 'fresa'
        ? Array.from({ length: 6 }, (_, i) => `<circle cx="${(((i % 3) - 1) * rx) / 2.4}" cy="${((Math.floor(i / 3) - 0.3) * ry) / 2}" r="3" fill="#ffd84a" opacity=".8"/>`).join('')
        : ''
    const tallo = fruta === 'mango' ? '' : `<path d="M0 ${-ry * 0.95} l${-rx * 0.25} ${-ry * 0.12} M0 ${-ry * 0.95} l${rx * 0.25} ${-ry * 0.12}" stroke="#2f7d32" stroke-width="7" stroke-linecap="round"/>`
    return `<g transform="translate(${cx} ${cy}) rotate(${giro})"><ellipse rx="${rx}" ry="${ry}" fill="url(#piel)"/>${semillas}${defecto}${tallo}</g>`
  })

  return (
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO}" height="${ALTO}">` +
        `<defs><radialGradient id="piel" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${color.brillo}"/><stop offset=".55" stop-color="${color.piel}"/><stop offset="1" stop-color="${color.sombra}"/></radialGradient></defs>` +
        `<rect width="${ANCHO}" height="${ALTO}" fill="#5b6470"/>` +
        `<rect x="24" y="24" width="${ANCHO - 48}" height="${ALTO - 48}" rx="36" fill="#e9e4d8"/>` +
        `<rect x="24" y="24" width="${ANCHO - 48}" height="${ALTO - 48}" rx="36" fill="none" stroke="#c9c1ae" stroke-width="10"/>` +
        piezas.join('') +
        '</svg>',
    )
  )
}

function mezclar<T>(lista: T[], azar: () => number): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
  }
  return lista
}

function generarDetalle(spec: LoteSpec): LoteDetalle {
  const azar = semilla(spec.id)
  const estado = spec.estado ?? 'analizado'
  const creado = haceDias(spec.analisis, spec.hora - 1, 30)
  const analizado = haceDias(spec.analisis, spec.hora, 5)

  // Lista de frutos: una entrada por fruto, con su clase (o null) y si quedó en revisión
  const codigos: { codigo: string; revision: boolean }[] = []
  if (estado === 'analizado') {
    for (const [codigo, n] of Object.entries(spec.clases ?? {})) {
      for (let i = 0; i < n; i++) codigos.push({ codigo, revision: false })
    }
    for (let i = 0; i < (spec.revision ?? 0); i++) {
      const posibles = Object.keys(DESTINO_CLASE[spec.fruta])
      codigos.push({ codigo: posibles[Math.floor(azar() * posibles.length)], revision: true })
    }
  }
  mezclar(codigos, azar)

  const fotoIds = Array.from({ length: spec.fotos }, (_, i) => `${spec.id.slice(0, 8)}-f${i + 1}`)
  const porFoto = Math.ceil(codigos.length / Math.max(1, spec.fotos))

  const frutos: FrutoDetalle[] = codigos.map(({ codigo, revision }, i) => {
    const foto = Math.floor(i / porFoto)
    const lugar = i % porFoto
    // Rejilla de 5 × 4 con un poco de variación, como fruta acomodada en una charola
    const celdaAncho = 0.92 / COLUMNAS
    const celdaAlto = 0.9 / FILAS
    const ancho = celdaAncho * (0.72 + azar() * 0.12)
    const alto = celdaAlto * (0.72 + azar() * 0.12)
    const x = 0.04 + (lugar % COLUMNAS) * celdaAncho + (celdaAncho - ancho) * azar()
    const y = 0.05 + Math.floor(lugar / COLUMNAS) * celdaAlto + (celdaAlto - alto) * azar()
    const destino = revision ? 'revision_manual' : DESTINO_CLASE[spec.fruta][codigo]
    return {
      id: `${fotoIds[foto]}-${String(lugar + 1).padStart(2, '0')}`,
      foto_id: fotoIds[foto],
      fruta_id: spec.fruta,
      conf_deteccion: Math.round((0.82 + azar() * 0.16) * 1000) / 1000,
      caja_x: x,
      caja_y: y,
      caja_ancho: ancho,
      caja_alto: alto,
      clase: { codigo, nombre: NOMBRE_CLASE[codigo] ?? codigo },
      conf_clasificacion: Math.round((revision ? 0.38 + azar() * 0.2 : 0.7 + azar() * 0.29) * 1000) / 1000,
      destino,
      requiere_revision: revision,
    }
  })

  const fotos: FotoDetalle[] = fotoIds.map((id, i) => ({
    id,
    lote_id: spec.id,
    storage_path: `usuario-demo/${spec.id}/${id}.jpg`,
    ancho: ANCHO,
    alto: ALTO,
    valida: true,
    motivo_rechazo: null,
    nitidez: null,
    brillo: null,
    created_at: haceDias(spec.analisis, spec.hora - 1, 40 + i),
    url: dibujarCharola(spec.fruta, frutos.filter((f) => f.foto_id === id), azar),
    url_marcada: null,
  }))

  let analisis: AnalisisLote | null = null
  const sugerencias: Sugerencia[] = []
  if (estado === 'analizado') {
    const clasificados = frutos.filter((f) => f.destino !== 'revision_manual')
    const conteo: Record<string, number> = {}
    for (const f of clasificados) conteo[f.clase!.codigo] = (conteo[f.clase!.codigo] ?? 0) + 1
    const sanos = clasificados.filter((f) => CLASES_SANAS.has(f.clase!.codigo)).length
    const separar = clasificados.filter((f) => f.destino === 'separar').length
    const pctSanos = Math.round((10000 * sanos) / clasificados.length) / 100
    const pctSeparar = Math.round((10000 * separar) / clasificados.length) / 100
    const umbral = UMBRALES.find((u) => pctSanos >= u.min && pctSeparar <= u.max)

    analisis = {
      id: `${spec.id.slice(0, 8)}-a1`,
      total_frutos: clasificados.length,
      frutos_sanos: sanos,
      frutos_separar: separar,
      frutos_revision: frutos.length - clasificados.length,
      pct_sanos: pctSanos,
      pct_separar: pctSeparar,
      conteo_por_clase: { [spec.fruta]: conteo },
      grado: umbral?.grado ?? 'rechazo',
      destino_lote: umbral?.destino ?? 'separar',
      muestra_pequena: clasificados.length < 30,
      modelo_version: spec.fruta === 'mango' ? 'mango-mobilenetv3-v2' : `${spec.fruta}-efficientnetb0-v1`,
      created_at: analizado,
    }

    // Una sugerencia por defecto encontrado. Texto de relleno: el real sale de la tabla fichas.
    for (const codigo of Object.keys(conteo).filter((c) => !CLASES_SANAS.has(c))) {
      sugerencias.push({
        id: `${spec.id.slice(0, 8)}-s-${codigo}`,
        ficha_id: null,
        texto: `Texto de ejemplo: aquí aparece la ficha de «${NOMBRE_CLASE[codigo]}» que escribió y verificó el equipo. Confirma con un técnico agrícola.`,
        origen: 'plantilla',
        created_at: analizado,
      })
    }
  }

  return {
    id: spec.id,
    usuario_id: 'usuario-demo',
    nombre: spec.nombre,
    fruta_principal: spec.fruta,
    parcela: spec.parcela,
    parcela_id: null,
    zona_id: spec.zona.id,
    zona_nombre: spec.zona.nombre,
    latitud: spec.coordenadas?.[0] ?? null,
    longitud: spec.coordenadas?.[1] ?? null,
    fecha_cosecha: fechaDia(spec.cosecha),
    destino_buscado: spec.fruta === 'mango' ? 'exportacion' : null,
    estado,
    created_at: creado,
    updated_at: creado,
    fotos,
    analisis,
    frutos,
    sugerencias,
  }
}

const DETALLES: readonly LoteDetalle[] = SPECS.map(generarDetalle)

/** Simula GET /lotes/{id}; null si no existe (la API responde 404). */
export function detalleLoteEjemplo(id: string): LoteDetalle | null {
  return DETALLES.find((lote) => lote.id === id) ?? null
}

/** Simula la vista bitacora_lotes + el conteo de frutos por destino de cada lote. */
export const lotesReporteEjemplo: LoteReporte[] = DETALLES.map((d) => {
  const a = d.analisis
  let porDestino: Record<Destino, number> | null = null
  if (a) {
    porDestino = Object.fromEntries(DESTINOS.map((x) => [x.codigo, 0])) as Record<Destino, number>
    for (const f of d.frutos) porDestino[f.destino] += 1
  }
  return {
    id: d.id,
    usuario_id: d.usuario_id,
    nombre: d.nombre,
    fruta_principal: d.fruta_principal,
    parcela: d.parcela,
    zona_id: d.zona_id,
    zona_nombre: d.zona_nombre,
    latitud: d.latitud,
    longitud: d.longitud,
    fecha_cosecha: d.fecha_cosecha,
    destino_buscado: d.destino_buscado,
    estado: d.estado,
    created_at: d.created_at,
    updated_at: d.updated_at,
    analisis_id: a?.id ?? null,
    total_frutos: a?.total_frutos ?? null,
    frutos_sanos: a?.frutos_sanos ?? null,
    frutos_separar: a?.frutos_separar ?? null,
    frutos_revision: a?.frutos_revision ?? null,
    pct_sanos: a?.pct_sanos ?? null,
    pct_separar: a?.pct_separar ?? null,
    conteo_por_clase: a?.conteo_por_clase ?? null,
    grado: a?.grado ?? null,
    destino_lote: a?.destino_lote ?? null,
    muestra_pequena: a?.muestra_pequena ?? null,
    modelo_version: a?.modelo_version ?? null,
    analizado_at: a?.created_at ?? null,
    frutos_por_destino: porDestino,
  }
})

/** Para la pantalla principal (misma fuente que Reportes, para que los números coincidan). */
export const lotesEjemplo: LoteBitacora[] = lotesReporteEjemplo

/** Frutos por destino en los lotes analizados (el destino lo asigna el trigger de la BD). */
export const frutosPorDestinoEjemplo: Record<Destino, number> = Object.fromEntries(
  DESTINOS.map((d) => [d.codigo, lotesReporteEjemplo.reduce((suma, l) => suma + (l.frutos_por_destino?.[d.codigo] ?? 0), 0)]),
) as Record<Destino, number>

export const alertasEjemplo: AlertaComunitaria[] = [
  { zona_id: 1, zona_nombre: 'Zona Centro', fruta_id: 'mango', clase_codigo: 'antracnosis', lotes_afectados: 4, ultimo_reporte: haceDias(1) },
  { zona_id: 2, zona_nombre: 'Zona Norte', fruta_id: 'fresa', clase_codigo: 'moho_gris', lotes_afectados: 3, ultimo_reporte: haceDias(3) },
]
