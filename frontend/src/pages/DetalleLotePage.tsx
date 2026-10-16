import { useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../lib/api'
import { DestinoChart } from '../components/dashboard/DestinoChart'
import { FichaFruto } from '../components/detalle/FichaFruto'
import { FotoMarcada } from '../components/detalle/FotoMarcada'
import { MapaFrutos } from '../components/detalle/MapaFrutos'
import { VisorFotos } from '../components/detalle/VisorFotos'
import { GradoInsignia } from '../components/reportes/GradoInsignia'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Grupo, Panel } from '../components/ui/Panel'
import { navegar, regresarA } from '../hooks/useRuta'
import {
  analisisDetenido,
  CLASES_SANAS,
  DESTINOS,
  formatFechaHora,
  formatFechaLarga,
  formatFrutos,
  formatNumero,
  formatPct,
  NOMBRE_CLASE,
  NOMBRE_DESTINO,
  NOMBRE_ESTADO,
  NOMBRE_GRADO,
  type Destino,
  type FrutoDetalle,
  type LoteDetalle,
} from '../utils/dominio'
import { nombreCultivo } from '../utils/reportes'
import '../styles/home.css'
import '../styles/detalle-lote.css'

type DetalleLotePageProps = {
  lote: LoteDetalle | null
  esEjemplo?: boolean
  onDescargarPdf: (lote: Pick<LoteDetalle, 'id'>) => void
  /** Vuelve a lanzar el análisis de un lote en `error` o atascado en `analizando`. */
  onReintentar?: () => Promise<void>
}

function BotonVolver() {
  return (
    <button type="button" className="detalle__volver" onClick={() => regresarA('/reportes')}>
      <Icon name="regresar" size={18} />
      Reportes
    </button>
  )
}

export function DetalleLotePage({ lote, esEjemplo = false, onDescargarPdf, onReintentar }: DetalleLotePageProps) {
  if (!lote) {
    return (
      <div className="detalle detalle--vacio">
        <span className="placeholder__icon">
          <Icon name="buscar" size={28} />
        </span>
        <h1 className="placeholder__title">No encontramos el lote</h1>
        <p className="placeholder__text">Puede que el enlace esté incompleto o que el lote ya no exista.</p>
        <Button onClick={() => navegar('/reportes')}>Ir a Reportes</Button>
      </div>
    )
  }
  // key: si cambia el lote, la selección y el visor empiezan de cero
  return <Detalle key={lote.id} lote={lote} esEjemplo={esEjemplo} onDescargarPdf={onDescargarPdf} onReintentar={onReintentar} />
}

function Detalle({
  lote,
  esEjemplo,
  onDescargarPdf,
  onReintentar,
}: {
  lote: LoteDetalle
  esEjemplo: boolean
  onDescargarPdf: DetalleLotePageProps['onDescargarPdf']
  onReintentar?: DetalleLotePageProps['onReintentar']
}) {
  const { analisis, fotos, frutos } = lote
  const cultivo = nombreCultivo(lote.fruta_principal)
  const lugar = lote.parcela ?? lote.zona_nombre ?? 'Sin parcela'

  const [fotoActiva, setFotoActiva] = useState(0)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [resaltado, setResaltado] = useState<Destino | null>(null)
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [reintentando, setReintentando] = useState(false)
  const [errorReintento, setErrorReintento] = useState<string | null>(null)
  const detenido = !analisis && analisisDetenido(lote)

  async function reintentar() {
    if (!onReintentar) return
    setReintentando(true)
    setErrorReintento(null)
    try {
      await onReintentar()
    } catch (error) {
      setErrorReintento(error instanceof ApiError ? error.message : 'No pudimos reintentar el análisis. Intenta de nuevo.')
    } finally {
      setReintentando(false)
    }
  }

  // Un número por fruto, en el orden de las fotos: une la foto, el mapa y la ficha
  const numeros = useMemo(() => new Map(frutos.map((f, i) => [f.id, i + 1])), [frutos])
  const numeroFoto = (fotoId: string) => fotos.findIndex((f) => f.id === fotoId) + 1
  const fruto = frutos.find((f) => f.id === seleccionado) ?? null
  const foto = fotos[fotoActiva]

  function seleccionar(f: FrutoDetalle) {
    setSeleccionado((actual) => (actual === f.id ? null : f.id))
    setFotoActiva(Math.max(0, fotos.findIndex((x) => x.id === f.foto_id)))
  }

  const altFoto = (i: number) => {
    const n = frutos.filter((f) => f.foto_id === fotos[i]?.id).length
    return `Foto ${i + 1} de ${fotos.length} de ${lote.nombre}: charola de ${cultivo.toLowerCase()} con ${formatFrutos(n)} marcados`
  }

  const ficha = fruto ? (
    <FichaFruto
      fruto={fruto}
      numero={numeros.get(fruto.id) ?? 0}
      foto={fotos.find((f) => f.id === fruto.foto_id)}
      numeroFoto={numeroFoto(fruto.foto_id)}
      onCerrar={() => setSeleccionado(null)}
    />
  ) : null

  // Frutos por destino (lo que asignó la BD a cada fruto)
  const porDestino = Object.fromEntries(DESTINOS.map((d) => [d.codigo, 0])) as Record<Destino, number>
  for (const f of frutos) porDestino[f.destino] += 1

  // Defectos: clases no sanas entre los frutos clasificados, de más a menos frecuente
  const defectos = new Map<string, { nombre: string; n: number; destinos: Set<Destino> }>()
  for (const f of frutos) {
    if (f.destino === 'revision_manual' || !f.clase || CLASES_SANAS.has(f.clase.codigo)) continue
    const actual = defectos.get(f.clase.codigo) ?? { nombre: f.clase.nombre, n: 0, destinos: new Set<Destino>() }
    actual.n += 1
    actual.destinos.add(f.destino)
    defectos.set(f.clase.codigo, actual)
  }
  const listaDefectos = [...defectos].sort((a, b) => b[1].n - a[1].n)

  // Historial: lo que la BD sabe del lote, ordenado en el tiempo
  const historial: { fecha: string; titulo: string; detalle?: string; destacado?: boolean }[] = []
  if (lote.created_at) historial.push({ fecha: lote.created_at, titulo: 'Lote registrado', detalle: `${lote.nombre} · ${lugar}` })
  if (fotos.length) {
    const ultima = fotos.reduce((a, b) => (a.created_at > b.created_at ? a : b))
    historial.push({ fecha: ultima.created_at, titulo: fotos.length === 1 ? '1 foto subida' : `${fotos.length} fotos subidas` })
  }
  if (analisis) {
    historial.push({
      fecha: analisis.created_at,
      titulo: `Análisis terminado · ${analisis.grado ? NOMBRE_GRADO[analisis.grado] : 'sin grado'}`,
      detalle: analisis.modelo_version ? `Modelo ${analisis.modelo_version}` : undefined,
      destacado: true,
    })
  }
  historial.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const datos: [string, ReactNode][] = [
    ['Nombre', lote.nombre],
    ['Cultivo', cultivo],
    ['Parcela', lote.parcela ?? '—'],
    ['Zona', lote.zona_nombre ?? '—'],
    ['Fecha de cosecha', formatFechaLarga(lote.fecha_cosecha)],
    ['Destino que buscas', lote.destino_buscado ? NOMBRE_DESTINO[lote.destino_buscado] : '—'],
    ['Estado', NOMBRE_ESTADO[lote.estado]],
    ['Registrado', formatFechaHora(lote.created_at)],
    ['Analizado', formatFechaHora(analisis?.created_at ?? null)],
    ['Modelo', analisis?.modelo_version ?? '—'],
  ]
  if (lote.latitud !== null && lote.longitud !== null) datos.push(['Ubicación', `${lote.latitud}, ${lote.longitud}`])
  datos.push(['ID del lote', <code key="id">{lote.id}</code>])

  return (
    <div className="detalle">
      <BotonVolver />

      {/* 1. Encabezado */}
      <header className="detalle__header">
        <GradoInsignia grado={analisis?.grado ?? null} estado={lote.estado} tamano="lg" />
        <div className="detalle__titulos">
          <p className="detalle__grado">
            {analisis?.grado ? NOMBRE_GRADO[analisis.grado] : NOMBRE_ESTADO[lote.estado]}
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
          <h1 className="detalle__title">
            {cultivo} · {lugar}
          </h1>
          <p className="detalle__meta">
            {lote.nombre} · <span className="detalle__id">#{lote.id.slice(0, 8)}</span> · Cosecha {formatFechaLarga(lote.fecha_cosecha)}
            {lote.zona_nombre && ` · ${lote.zona_nombre}`}
          </p>
        </div>
        {analisis && (
          <Button className="detalle__pdf" onClick={() => onDescargarPdf(lote)}>
            <Icon name="descargar" size={18} />
            Descargar PDF
          </Button>
        )}
      </header>

      {/* 2. Veredicto + destino */}
      <Grupo titulo="Resumen">
        <Panel titulo="Veredicto" className="veredicto">
          {analisis && analisis.pct_sanos !== null ? (
            <>
              <p className="veredicto__pct">
                {formatPct(analisis.pct_sanos)}
                <span className="veredicto__pct-label">frutos sanos</span>
              </p>
              <p className="veredicto__base">
                {formatNumero(analisis.frutos_sanos)} de {formatFrutos(analisis.total_frutos)} clasificados
              </p>
              <dl className="veredicto__datos">
                <div>
                  <dt>Analizados</dt>
                  <dd>{formatNumero(analisis.total_frutos + analisis.frutos_revision)}</dd>
                </div>
                <div>
                  <dt>Para separar</dt>
                  <dd>
                    {formatNumero(analisis.frutos_separar)}
                    <span className="veredicto__sub"> · {formatPct(analisis.pct_separar)}</span>
                  </dd>
                </div>
                <div>
                  <dt>Revisión manual</dt>
                  <dd>{formatNumero(analisis.frutos_revision)}</dd>
                </div>
              </dl>
              {analisis.destino_lote && (
                <p className="veredicto__destino">
                  <span className="chip__punto" data-destino={analisis.destino_lote} aria-hidden="true" />
                  Destino sugerido del lote: <strong>{NOMBRE_DESTINO[analisis.destino_lote]}</strong>
                </p>
              )}
              {analisis.muestra_pequena && (
                <p className="veredicto__aviso">Muestra pequeña: menos de 30 frutos. Toma más fotos para un grado más confiable.</p>
              )}
              {analisis.frutos_revision > 0 && (
                <p className="veredicto__nota">Los frutos en revisión manual no cuentan para el porcentaje ni para el grado.</p>
              )}
            </>
          ) : (
            <>
              <p className="veredicto__pendiente">
                {lote.estado === 'error'
                  ? 'No pudimos analizar este lote.'
                  : lote.estado === 'analizando'
                    ? detenido
                      ? 'El análisis tardó más de lo normal y se detuvo.'
                      : 'Estamos analizando las fotos de este lote. El resultado aparece aquí en cuanto termine.'
                    : 'Este lote todavía no tiene análisis. Sube fotos de la charola para analizarlo.'}
              </p>
              {detenido && onReintentar && (
                <Button onClick={reintentar} loading={reintentando}>
                  Reintentar análisis
                </Button>
              )}
              {errorReintento && <p className="veredicto__aviso">{errorReintento}</p>}
            </>
          )}
        </Panel>

        {analisis && frutos.length > 0 && (
          <Panel titulo="Destino de los frutos" subtitulo={`${formatFrutos(frutos.length)} detectados`}>
            <DestinoChart conteo={porDestino} />
          </Panel>
        )}
      </Grupo>

      {/* 3. Imágenes + 5. resultado por fruto */}
      <Grupo titulo="Imágenes y frutos">
        <Panel
          titulo="Fotos del lote"
          subtitulo={fotos.length ? `${fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`} · toca un fruto para ver su resultado` : undefined}
          className="fotos-panel"
        >
          {foto ? (
            <>
              <div className="fotos-panel__principal">
                <FotoMarcada
                  key={foto.id}
                  foto={foto}
                  frutos={frutos.filter((f) => f.foto_id === foto.id)}
                  numeros={numeros}
                  alt={altFoto(fotoActiva)}
                  seleccionado={seleccionado}
                  resaltado={resaltado}
                  onSeleccionar={seleccionar}
                />
                <button type="button" className="fotos-panel__ampliar" onClick={() => setVisorAbierto(true)}>
                  <Icon name="ampliar" size={18} />
                  <span>Ampliar</span>
                </button>
              </div>

              {fotos.length > 1 && (
                <ul className="miniaturas" aria-label="Elegir foto">
                  {fotos.map((f, i) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="miniaturas__boton"
                        aria-pressed={i === fotoActiva}
                        aria-label={`Ver foto ${i + 1}`}
                        onClick={() => setFotoActiva(i)}
                      >
                        {f.url && <img src={f.url} alt="" loading="lazy" decoding="async" draggable={false} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="fotos-panel__vacio">
              <Icon name="galeria" size={28} />
              <p>Este lote no tiene imágenes.</p>
            </div>
          )}
        </Panel>

        {frutos.length > 0 && (
          <Panel titulo="Resultado por fruto" subtitulo="Toca un destino para resaltar sus frutos" className="frutos-panel">
            <MapaFrutos
              frutos={frutos}
              numeros={numeros}
              seleccionado={seleccionado}
              resaltado={resaltado}
              onSeleccionar={seleccionar}
              onResaltar={setResaltado}
            />
            {/* En celular la ficha flota abajo; en escritorio vive dentro de este panel */}
            <div className="frutos-panel__ficha" data-open={fruto ? true : undefined} aria-live="polite">
              {ficha ?? <p className="frutos-panel__ayuda">Toca un fruto en la foto o en el mapa para ver su resultado.</p>}
            </div>
          </Panel>
        )}
      </Grupo>

      {/* 4. Resultados del análisis */}
      {analisis && (
        <Grupo titulo="Análisis">
          <Panel titulo="Defectos detectados" subtitulo={`Sobre ${formatFrutos(analisis.total_frutos)} clasificados`}>
            {listaDefectos.length ? (
              <ul className="defectos">
                {listaDefectos.map(([codigo, d]) => (
                  <li key={codigo} className="defectos__fila">
                    <span className="defectos__nombre">{d.nombre ?? NOMBRE_CLASE[codigo]}</span>
                    <span className="defectos__n">{formatFrutos(d.n)}</span>
                    <span className="defectos__pct">{formatPct(analisis.total_frutos ? (100 * d.n) / analisis.total_frutos : null)}</span>
                    {[...d.destinos].map((destino) => (
                      <span key={destino} className="etiqueta-destino" data-destino-suave={destino}>
                        {NOMBRE_DESTINO[destino]}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No encontramos defectos en los frutos clasificados.</p>
            )}
          </Panel>

          <Panel titulo="Recomendaciones" subtitulo="Escritas y verificadas por el equipo">
            {lote.sugerencias.length ? (
              <ul className="sugerencias">
                {lote.sugerencias.map((s) => (
                  <li key={s.id}>{s.texto}</li>
                ))}
              </ul>
            ) : (
              <p className="empty">No hay recomendaciones para este lote.</p>
            )}
          </Panel>
        </Grupo>
      )}

      {/* 6. Historial + 7. Datos del lote */}
      <Grupo titulo="Registro">
        <Panel titulo="Historial del lote">
          <ol className="historial">
            {historial.map((evento) => (
              <li key={evento.titulo} className="historial__evento" data-destacado={evento.destacado || undefined}>
                <time className="historial__fecha" dateTime={evento.fecha}>
                  {formatFechaHora(evento.fecha)}
                </time>
                <p className="historial__titulo">{evento.titulo}</p>
                {evento.detalle && <p className="historial__detalle">{evento.detalle}</p>}
              </li>
            ))}
            {lote.estado === 'analizando' && !detenido && (
              <li className="historial__evento" data-en-curso>
                <p className="historial__titulo">Análisis en curso…</p>
              </li>
            )}
          </ol>
        </Panel>

        <Panel titulo="Datos del lote">
          <dl className="datos-lote">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </Grupo>

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>

      <VisorFotos
        abierto={visorAbierto}
        fotos={fotos}
        indice={fotoActiva}
        frutos={frutos}
        numeros={numeros}
        altFoto={altFoto}
        seleccionado={seleccionado}
        resaltado={resaltado}
        onSeleccionar={seleccionar}
        onCambiar={setFotoActiva}
        onCerrar={() => setVisorAbierto(false)}
        detalle={ficha}
      />
    </div>
  )
}
