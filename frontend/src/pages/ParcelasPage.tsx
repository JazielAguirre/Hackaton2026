import { useMemo, useState } from 'react'
import { StatTile } from '../components/dashboard/StatTile'
import { GradosPorParcela } from '../components/parcelas/GradosPorParcela'
import { RegistrarParcela, type NuevaParcela } from '../components/parcelas/RegistrarParcela'
import { SanosPorParcela } from '../components/parcelas/SanosPorParcela'
import { Button } from '../components/ui/Button'
import { Enlace } from '../components/ui/Enlace'
import { Icon } from '../components/ui/Icon'
import { navegar, useRuta } from '../hooks/useRuta'
import { formatFechaLarga, formatNumero, formatPct, GRADOS, type LoteReporte, type Parcela } from '../utils/dominio'
import { resumirParcela, rutaParcela, ubicacion } from '../utils/parcelas'
import '../styles/home.css'
import '../styles/reportes.css'
import '../styles/parcelas.css'

type ParcelasPageProps = {
  /** Parcelas activas del usuario. */
  parcelas: Parcela[]
  lotes: LoteReporte[]
  esEjemplo?: boolean
  onRegistrar: (parcela: NuevaParcela) => void | Promise<void>
}

export function ParcelasPage({ parcelas, lotes, esEjemplo = false, onRegistrar }: ParcelasPageProps) {
  // «Registrar una» en Nuevo análisis llega aquí con ?nueva=1 y abre la hoja directamente
  const { params } = useRuta()
  const [registrando, setRegistrando] = useState(params.get('nueva') === '1')
  const resumenes = useMemo(() => parcelas.map((p) => resumirParcela(p, lotes)), [parcelas, lotes])

  // Totales de todas las parcelas, ponderados por frutos (igual que en cada lote)
  const frutos = resumenes.reduce((s, r) => s + r.frutosClasificados, 0)
  const sanos = resumenes.reduce((s, r) => s + ((r.pctSanos ?? 0) * r.frutosClasificados) / 100, 0)
  const analizados = resumenes.reduce((s, r) => s + r.analizados, 0)
  const totalLotes = resumenes.reduce((s, r) => s + r.lotes.length, 0)

  return (
    <div className="parcelas-page">
      <header className="reportes-page__header">
        <div>
          <h1 className="reportes-page__title">Parcelas</h1>
          <p className="reportes-page__subtitle">
            Tus parcelas y la calidad de los lotes analizados en cada una.
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
        </div>
        <Button onClick={() => setRegistrando(true)}>
          <Icon name="mas" size={18} />
          Registrar parcela
        </Button>
      </header>

      <section aria-label="Indicadores">
        <div className="stats">
          <StatTile label="Parcelas activas" value={formatNumero(parcelas.length)} />
          <StatTile label="Lotes analizados" value={formatNumero(analizados)} detail="En todas las parcelas" />
          <StatTile label="Frutos sanos" value={frutos ? formatPct((100 * sanos) / frutos) : '—'} detail={`De ${formatNumero(frutos)} frutos`} />
          <StatTile label="Lotes registrados" value={formatNumero(totalLotes)} detail="Con o sin análisis" />
        </div>
      </section>

      <section className="dashboard" aria-label="Gráficas por parcela">
        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Grado de los lotes por parcela</h2>
            <p className="card__subtitle">Proporción de lotes en cada grado</p>
          </header>
          <GradosPorParcela resumenes={resumenes} />
        </article>

        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Frutos sanos por parcela</h2>
            <p className="card__subtitle">Porcentaje sobre los frutos clasificados</p>
          </header>
          <SanosPorParcela resumenes={resumenes} />
        </article>
      </section>

      <section className="parcelas-catalogo" aria-labelledby="catalogo-titulo">
        <h2 id="catalogo-titulo" className="detalle-grupo__titulo">
          Mis parcelas
        </h2>
        {resumenes.length === 0 && <p className="empty">Todavía no registras ninguna parcela. Usa «Registrar parcela» para empezar.</p>}
        <ul className="parcelas-catalogo__lista">
          {resumenes.map((r) => (
            <li key={r.parcela.id} className="tarjeta-parcela">
              <div className="tarjeta-parcela__top">
                <span className="tarjeta-parcela__icono" aria-hidden="true">
                  <Icon name="parcela" />
                </span>
                <div className="tarjeta-parcela__info">
                  {/* El enlace cubre toda la tarjeta */}
                  <Enlace href={rutaParcela(r.parcela.id)} className="tarjeta-parcela__nombre">
                    {r.parcela.nombre}
                  </Enlace>
                  <p className="tarjeta-parcela__meta">
                    {r.lotes.length === 0 ? 'Sin lotes' : `${r.lotes.length} ${r.lotes.length === 1 ? 'lote' : 'lotes'}`}
                    {' · '}
                    {ubicacion(r.parcela)}
                  </p>
                </div>
              </div>

              {r.analizados > 0 ? (
                <>
                  <div className="tarjeta-parcela__barra" aria-hidden="true">
                    {GRADOS.filter((g) => r.porGrado[g] > 0).map((g) => (
                      <span key={g} data-grado={g} style={{ flexGrow: r.porGrado[g] }} />
                    ))}
                  </div>
                  <p className="tarjeta-parcela__datos">
                    <span>
                      <strong>{formatPct(r.pctSanos)}</strong> sanos
                    </span>
                    <span>
                      {r.analizados} {r.analizados === 1 ? 'analizado' : 'analizados'}
                    </span>
                    <span>{GRADOS.filter((g) => r.porGrado[g]).map((g) => `${r.porGrado[g]} ${g === 'rechazo' ? 'rechazo' : g}`).join(' · ')}</span>
                  </p>
                  <p className="tarjeta-parcela__fecha">Último análisis: {formatFechaLarga(r.ultimoAnalisis)}</p>
                </>
              ) : (
                <p className="tarjeta-parcela__vacia">Sin lotes analizados todavía.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>

      <RegistrarParcela abierto={registrando} existentes={parcelas} onCerrar={() => {
          setRegistrando(false)
          if (params.has('nueva')) navegar('/parcelas', { replace: true })
        }} onGuardar={onRegistrar} />
    </div>
  )
}
