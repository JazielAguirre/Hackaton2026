import { useMemo, useState } from 'react'
import { StatTile } from '../components/dashboard/StatTile'
import { GradosPorZona } from '../components/zonas/GradosPorZona'
import { RegistrarZona, type NuevaZona } from '../components/zonas/RegistrarZona'
import { SanosPorZona } from '../components/zonas/SanosPorZona'
import { Button } from '../components/ui/Button'
import { Enlace } from '../components/ui/Enlace'
import { Icon } from '../components/ui/Icon'
import { formatFechaLarga, formatNumero, formatPct, GRADOS, type AlertaComunitaria, type LoteReporte, type Zona } from '../utils/dominio'
import { resumirZona, rutaZona } from '../utils/zonas'
import '../styles/home.css'
import '../styles/reportes.css'
import '../styles/zonas.css'

type ZonasPageProps = {
  zonas: Zona[]
  lotes: LoteReporte[]
  alertas: AlertaComunitaria[]
  esEjemplo?: boolean
  onRegistrar: (zona: NuevaZona) => void
}

export function ZonasPage({ zonas, lotes, alertas, esEjemplo = false, onRegistrar }: ZonasPageProps) {
  const [registrando, setRegistrando] = useState(false)
  const activas = useMemo(() => zonas.filter((z) => z.activa), [zonas])
  const resumenes = useMemo(() => activas.map((z) => resumirZona(z, lotes, alertas)), [activas, lotes, alertas])

  // Totales de todas las zonas, ponderados por frutos (igual que en cada lote)
  const frutos = resumenes.reduce((s, r) => s + r.frutosClasificados, 0)
  const sanos = resumenes.reduce((s, r) => s + ((r.pctSanos ?? 0) * r.frutosClasificados) / 100, 0)
  const analizados = resumenes.reduce((s, r) => s + r.analizados, 0)
  const conAlerta = resumenes.filter((r) => r.alertas.length).length

  return (
    <div className="zonas-page">
      <header className="reportes-page__header">
        <div>
          <h1 className="reportes-page__title">Zonas</h1>
          <p className="reportes-page__subtitle">
            Calidad de los lotes en cada zona, según sus análisis.
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
        </div>
        <Button onClick={() => setRegistrando(true)}>
          <Icon name="mas" size={18} />
          Registrar zona
        </Button>
      </header>

      <section aria-label="Indicadores">
        <div className="stats">
          <StatTile label="Zonas activas" value={formatNumero(activas.length)} />
          <StatTile label="Lotes analizados" value={formatNumero(analizados)} detail="En todas las zonas" />
          <StatTile label="Frutos sanos" value={frutos ? formatPct((100 * sanos) / frutos) : '—'} detail={`De ${formatNumero(frutos)} frutos`} />
          <StatTile
            label="Zonas con alerta"
            value={formatNumero(conAlerta)}
            detail={conAlerta ? 'Defectos repetidos esta semana' : 'Sin brotes esta semana'}
          />
        </div>
      </section>

      <section className="dashboard" aria-label="Gráficas por zona">
        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Grado de los lotes por zona</h2>
            <p className="card__subtitle">Proporción de lotes en cada grado</p>
          </header>
          <GradosPorZona resumenes={resumenes} />
        </article>

        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Frutos sanos por zona</h2>
            <p className="card__subtitle">Porcentaje sobre los frutos clasificados</p>
          </header>
          <SanosPorZona resumenes={resumenes} />
        </article>
      </section>

      <section className="zonas-catalogo" aria-labelledby="catalogo-titulo">
        <h2 id="catalogo-titulo" className="detalle-grupo__titulo">
          Catálogo de zonas
        </h2>
        <ul className="zonas-catalogo__lista">
          {resumenes.map((r) => (
            <li key={r.zona.id} className="tarjeta-zona">
              <div className="tarjeta-zona__top">
                <span className="tarjeta-zona__icono" aria-hidden="true">
                  <Icon name="zona" />
                </span>
                <div className="tarjeta-zona__info">
                  {/* El enlace cubre toda la tarjeta */}
                  <Enlace href={rutaZona(r.zona.id)} className="tarjeta-zona__nombre">
                    {r.zona.nombre}
                  </Enlace>
                  <p className="tarjeta-zona__meta">{[r.zona.municipio, r.zona.estado].filter(Boolean).join(', ') || 'Sin municipio'}</p>
                </div>
                {r.alertas.length > 0 && (
                  <span className="tarjeta-zona__alerta">
                    <Icon name="alerta" size={14} />
                    {r.alertas.length === 1 ? '1 alerta' : `${r.alertas.length} alertas`}
                  </span>
                )}
              </div>

              {r.analizados > 0 ? (
                <>
                  <div className="tarjeta-zona__barra" aria-hidden="true">
                    {GRADOS.filter((g) => r.porGrado[g] > 0).map((g) => (
                      <span key={g} data-grado={g} style={{ flexGrow: r.porGrado[g] }} />
                    ))}
                  </div>
                  <p className="tarjeta-zona__datos">
                    <span>
                      <strong>{formatPct(r.pctSanos)}</strong> sanos
                    </span>
                    <span>
                      {r.analizados} {r.analizados === 1 ? 'lote' : 'lotes'}
                    </span>
                    <span>{GRADOS.filter((g) => r.porGrado[g]).map((g) => `${r.porGrado[g]} ${g === 'rechazo' ? 'rechazo' : g}`).join(' · ')}</span>
                  </p>
                  <p className="tarjeta-zona__fecha">Último análisis: {formatFechaLarga(r.ultimoAnalisis)}</p>
                </>
              ) : (
                <p className="tarjeta-zona__vacia">Sin lotes analizados todavía.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>

      <RegistrarZona abierto={registrando} existentes={zonas} onCerrar={() => setRegistrando(false)} onGuardar={onRegistrar} />
    </div>
  )
}
