import { DestinoChart } from '../components/dashboard/DestinoChart'
import { GradoChart } from '../components/dashboard/GradoChart'
import { StatTile } from '../components/dashboard/StatTile'
import { EnlaceLote } from '../components/reportes/EnlaceLote'
import { GradoInsignia } from '../components/reportes/GradoInsignia'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Grupo, Panel } from '../components/ui/Panel'
import { navegar, regresarA } from '../hooks/useRuta'
import { formatFechaLarga, formatFrutos, formatNumero, formatPct, NOMBRE_CLASE, NOMBRE_ESTADO, NOMBRE_FRUTA, type LoteReporte } from '../utils/dominio'
import { nombreCultivo } from '../utils/reportes'
import { ubicacion, type ResumenParcela } from '../utils/parcelas'
import '../styles/home.css'
import '../styles/reportes.css'
import '../styles/detalle-lote.css'
import '../styles/parcelas.css'

type ParcelaDetallePageProps = {
  resumen: ResumenParcela | null
  onDescargarPdf?: (lote: LoteReporte) => void
  esEjemplo?: boolean
}

export function ParcelaDetallePage({ resumen, onDescargarPdf, esEjemplo = false }: ParcelaDetallePageProps) {
  if (!resumen) {
    return (
      <div className="detalle detalle--vacio">
        <span className="placeholder__icon">
          <Icon name="parcela" size={28} />
        </span>
        <h1 className="placeholder__title">No encontramos la parcela</h1>
        <p className="placeholder__text">Puede que el enlace esté incompleto o que la parcela ya no exista.</p>
        <Button onClick={() => navegar('/parcelas')}>Ir a Parcelas</Button>
      </div>
    )
  }

  const { parcela, lotes, analizados, porGrado, porDestino, defectos } = resumen
  const enProceso = lotes.length - analizados
  const totalDefectos = defectos.reduce((s, d) => s + d.n, 0)
  const ordenados = [...lotes].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return (
    <div className="detalle">
      <button type="button" className="detalle__volver" onClick={() => regresarA('/parcelas')}>
        <Icon name="regresar" size={18} />
        Parcelas
      </button>

      <header className="parcela-header">
        <span className="parcela-header__icono" aria-hidden="true">
          <Icon name="parcela" size={30} />
        </span>
        <div>
          <p className="detalle__grado">
            {parcela.activa ? 'Parcela activa' : 'Parcela inactiva'}
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
          <h1 className="detalle__title">{parcela.nombre}</h1>
          <p className="detalle__meta">
            {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'} · {ubicacion(parcela)}
          </p>
        </div>
      </header>

      <section aria-label="Indicadores de la parcela">
        <div className="stats">
          <StatTile label="Lotes analizados" value={formatNumero(analizados)} detail={enProceso ? `${enProceso} sin terminar` : undefined} />
          <StatTile label="Frutos clasificados" value={formatNumero(resumen.frutosClasificados)} />
          <StatTile label="Frutos sanos" value={formatPct(resumen.pctSanos)} detail="Sin contar revisión manual" />
          <StatTile label="Para separar" value={formatPct(resumen.pctSeparar)} />
        </div>
      </section>

      {analizados === 0 ? (
        <div className="card parcela-vacia">
          <Icon name="reporte" size={28} />
          <p>Esta parcela todavía no tiene lotes analizados. Cuando analices un lote de esta parcela, verás sus resultados.</p>
        </div>
      ) : (
        <>
          <Grupo titulo="Calidad">
            <Panel titulo="Grado de los lotes" subtitulo={`${analizados} ${analizados === 1 ? 'lote analizado' : 'lotes analizados'}`}>
              <GradoChart conteo={porGrado} />
            </Panel>
            <Panel titulo="Destino de los frutos" subtitulo={`${formatFrutos(Object.values(porDestino).reduce((a, b) => a + b, 0))} detectados`}>
              <DestinoChart conteo={porDestino} />
            </Panel>
          </Grupo>

          <Grupo titulo="Sanidad">
            <Panel titulo="Defectos más frecuentes" subtitulo="Frutos con cada defecto en la parcela">
              {defectos.length ? (
                <ul className="defectos">
                  {defectos.slice(0, 6).map((d) => (
                    <li key={`${d.fruta}-${d.codigo}`} className="defectos__fila">
                      <span className="defectos__nombre">
                        {NOMBRE_CLASE[d.codigo] ?? d.codigo}
                        <span className="tabla-lotes__sub">{NOMBRE_FRUTA[d.fruta] ?? d.fruta}</span>
                      </span>
                      <span className="defectos__n">{formatFrutos(d.n)}</span>
                      <span className="defectos__pct">{formatPct((100 * d.n) / totalDefectos)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No se encontraron defectos en esta parcela.</p>
              )}
            </Panel>
          </Grupo>
        </>
      )}

      <Grupo titulo="Registro">
        <Panel titulo="Lotes de la parcela" subtitulo={lotes.length ? `${lotes.length} en total` : undefined}>
          {ordenados.length ? (
            <ul className="lotes-parcela">
              {ordenados.map((l) => {
                const listo = l.estado === 'analizado' && l.analisis_id !== null
                return (
                  <li key={l.id} className="lotes-parcela__fila">
                    <GradoInsignia grado={l.grado} estado={l.estado} tamano="sm" />
                    <div className="lotes-parcela__info">
                      <EnlaceLote id={l.id} className="lotes-parcela__nombre">
                        {l.nombre}
                      </EnlaceLote>
                      <span className="tabla-lotes__sub">
                        {nombreCultivo(l.fruta_principal)} · {formatFechaLarga(l.fecha_cosecha)}
                      </span>
                    </div>
                    <span className="lotes-parcela__valor">{listo ? `${formatPct(l.pct_sanos)} sanos` : l.estado ? NOMBRE_ESTADO[l.estado] : ''}</span>
                    {listo && onDescargarPdf && (
                      <button
                        type="button"
                        className="tabla-lotes__accion"
                        aria-label={`Descargar PDF de ${l.nombre}`}
                        onClick={() => onDescargarPdf(l)}
                      >
                        <Icon name="descargar" size={18} />
                        PDF
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="empty">Todavía no hay lotes en esta parcela.</p>
          )}
        </Panel>

        <Panel titulo="Datos de la parcela">
          <dl className="datos-lote">
            <div>
              <dt>Nombre</dt>
              <dd>{parcela.nombre}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{parcela.latitud !== null && parcela.longitud !== null ? `${parcela.latitud}, ${parcela.longitud}` : '—'}</dd>
            </div>
            <div>
              <dt>Último análisis</dt>
              <dd>{formatFechaLarga(resumen.ultimoAnalisis)}</dd>
            </div>
            <div>
              <dt>Registrada</dt>
              <dd>{formatFechaLarga(parcela.created_at)}</dd>
            </div>
          </dl>
        </Panel>
      </Grupo>

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>
    </div>
  )
}
