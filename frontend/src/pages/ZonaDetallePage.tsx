import { AlertasZona } from '../components/dashboard/AlertasZona'
import { DestinoChart } from '../components/dashboard/DestinoChart'
import { GradoChart } from '../components/dashboard/GradoChart'
import { StatTile } from '../components/dashboard/StatTile'
import { EnlaceLote } from '../components/reportes/EnlaceLote'
import { GradoInsignia } from '../components/reportes/GradoInsignia'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Grupo, Panel } from '../components/ui/Panel'
import { navegar, regresarA } from '../hooks/useRuta'
import { formatFechaLarga, formatFrutos, formatNumero, formatPct, NOMBRE_CLASE, NOMBRE_ESTADO, NOMBRE_FRUTA } from '../utils/dominio'
import { nombreCultivo } from '../utils/reportes'
import type { ResumenZona } from '../utils/zonas'
import '../styles/home.css'
import '../styles/reportes.css'
import '../styles/detalle-lote.css'
import '../styles/zonas.css'

type ZonaDetallePageProps = {
  resumen: ResumenZona | null
  esEjemplo?: boolean
}

export function ZonaDetallePage({ resumen, esEjemplo = false }: ZonaDetallePageProps) {
  if (!resumen) {
    return (
      <div className="detalle detalle--vacio">
        <span className="placeholder__icon">
          <Icon name="zona" size={28} />
        </span>
        <h1 className="placeholder__title">No encontramos la zona</h1>
        <p className="placeholder__text">Puede que el enlace esté incompleto o que la zona ya no exista.</p>
        <Button onClick={() => navegar('/zonas')}>Ir a Zonas</Button>
      </div>
    )
  }

  const { zona, lotes, analizados, porGrado, porDestino, defectos, alertas } = resumen
  const enProceso = lotes.length - analizados
  const totalDefectos = defectos.reduce((s, d) => s + d.n, 0)
  const ordenados = [...lotes].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return (
    <div className="detalle">
      <button type="button" className="detalle__volver" onClick={() => regresarA('/zonas')}>
        <Icon name="regresar" size={18} />
        Zonas
      </button>

      <header className="zona-header">
        <span className="zona-header__icono" aria-hidden="true">
          <Icon name="zona" size={30} />
        </span>
        <div>
          <p className="detalle__grado">
            {zona.activa ? 'Zona activa' : 'Zona inactiva'}
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
          <h1 className="detalle__title">{zona.nombre}</h1>
          <p className="detalle__meta">{[zona.municipio, zona.estado].filter(Boolean).join(', ') || 'Sin municipio registrado'}</p>
        </div>
      </header>

      <section aria-label="Indicadores de la zona">
        <div className="stats">
          <StatTile label="Lotes analizados" value={formatNumero(analizados)} detail={enProceso ? `${enProceso} sin terminar` : undefined} />
          <StatTile label="Frutos clasificados" value={formatNumero(resumen.frutosClasificados)} />
          <StatTile label="Frutos sanos" value={formatPct(resumen.pctSanos)} detail="Sin contar revisión manual" />
          <StatTile label="Para separar" value={formatPct(resumen.pctSeparar)} />
        </div>
      </section>

      {analizados === 0 ? (
        <div className="card zona-vacia">
          <Icon name="reporte" size={28} />
          <p>Esta zona todavía no tiene lotes analizados. Cuando un productor analice un lote aquí, verás sus resultados.</p>
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
            <Panel titulo="Defectos más frecuentes" subtitulo="Frutos con cada defecto en la zona">
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
                <p className="empty">No se encontraron defectos en esta zona.</p>
              )}
            </Panel>
            <Panel titulo="Alertas de la zona" subtitulo="Defectos repetidos en varios lotes en los últimos 7 días">
              <AlertasZona alertas={alertas} />
            </Panel>
          </Grupo>
        </>
      )}

      <Grupo titulo="Registro">
        <Panel titulo="Lotes de la zona" subtitulo={lotes.length ? `${lotes.length} en total` : undefined}>
          {ordenados.length ? (
            <ul className="lotes-zona">
              {ordenados.map((l) => {
                const listo = l.estado === 'analizado' && l.analisis_id !== null
                return (
                  <li key={l.id} className="lotes-zona__fila">
                    <GradoInsignia grado={l.grado} estado={l.estado} tamano="sm" />
                    <div className="lotes-zona__info">
                      <EnlaceLote id={l.id} className="lotes-zona__nombre">
                        {nombreCultivo(l.fruta_principal)} · {l.parcela ?? 'Sin parcela'}
                      </EnlaceLote>
                      <span className="tabla-lotes__sub">
                        {l.nombre} · {formatFechaLarga(l.fecha_cosecha)}
                      </span>
                    </div>
                    <span className="lotes-zona__valor">{listo ? `${formatPct(l.pct_sanos)} sanos` : l.estado ? NOMBRE_ESTADO[l.estado] : ''}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="empty">Todavía no hay lotes en esta zona.</p>
          )}
        </Panel>

        <Panel titulo="Datos de la zona">
          <dl className="datos-lote">
            <div>
              <dt>Nombre</dt>
              <dd>{zona.nombre}</dd>
            </div>
            <div>
              <dt>Municipio</dt>
              <dd>{zona.municipio ?? '—'}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{zona.estado ?? '—'}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{zona.latitud !== null && zona.longitud !== null ? `${zona.latitud}, ${zona.longitud}` : '—'}</dd>
            </div>
            <div>
              <dt>Último análisis</dt>
              <dd>{formatFechaLarga(resumen.ultimoAnalisis)}</dd>
            </div>
            <div>
              <dt>ID de la zona</dt>
              <dd>
                <code>{zona.id}</code>
              </dd>
            </div>
          </dl>
        </Panel>
      </Grupo>

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>
    </div>
  )
}
