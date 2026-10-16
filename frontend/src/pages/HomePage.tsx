import { AlertasZona } from '../components/dashboard/AlertasZona'
import { DestinoChart } from '../components/dashboard/DestinoChart'
import { GradoChart } from '../components/dashboard/GradoChart'
import { ReporteLotes } from '../components/dashboard/ReporteLotes'
import { StatTile } from '../components/dashboard/StatTile'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { alertasEjemplo, frutosPorDestinoEjemplo, lotesEjemplo } from '../services/datosEjemplo'
import { formatNumero, GRADOS, type Grado, type LoteBitacora } from '../utils/dominio'
import '../styles/home.css'

type HomePageProps = {
  nombre: string
  onNuevoAnalisis: () => void
  onVerReportes: () => void
  onDescargarReporte: (lote: LoteBitacora) => void
}

export function HomePage({ nombre, onNuevoAnalisis, onVerReportes, onDescargarReporte }: HomePageProps) {
  const analizados = lotesEjemplo.filter((lote) => lote.estado === 'analizado')
  const enProceso = lotesEjemplo.length - analizados.length
  const sumar = (campo: 'total_frutos' | 'frutos_sanos' | 'frutos_revision') =>
    analizados.reduce((suma, lote) => suma + (lote[campo] ?? 0), 0)

  const totalFrutos = sumar('total_frutos')
  // Igual que en la BD: el porcentaje se calcula sin contar revision_manual
  const clasificados = totalFrutos - sumar('frutos_revision')
  const pctSanos = clasificados ? Math.round((sumar('frutos_sanos') / clasificados) * 100) : 0

  const porGrado = Object.fromEntries(GRADOS.map((grado) => [grado, 0])) as Record<Grado, number>
  for (const lote of analizados) {
    if (lote.grado) porGrado[lote.grado] += 1
  }

  return (
    <div className="home">
      <section className="home__intro">
        <div>
          <p className="home__eyebrow">
            Resumen de tus lotes <span className="demo-pill">Datos de ejemplo</span>
          </p>
          <h1 className="home__title">Hola, {nombre}</h1>
        </div>
        <Button onClick={onNuevoAnalisis}>
          <Icon name="mas" size={18} />
          Analizar lote
        </Button>
      </section>

      <section id="resumen" className="home__section" aria-label="Indicadores">
        <div className="stats">
          <StatTile label="Lotes analizados" value={formatNumero(analizados.length)} detail={enProceso ? `${enProceso} en análisis` : undefined} />
          <StatTile label="Frutos revisados" value={formatNumero(totalFrutos)} />
          <StatTile label="Frutos sanos" value={`${pctSanos}%`} detail="Sin contar revisión manual" />
          <StatTile label="Lotes en rechazo" value={formatNumero(porGrado.rechazo)} />
        </div>
      </section>

      <section className="home__section dashboard" aria-label="Gráficas">
        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Grado de los lotes</h2>
            <p className="card__subtitle">Número de lotes por grado</p>
          </header>
          <GradoChart conteo={porGrado} />
        </article>

        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Destino de los frutos</h2>
            <p className="card__subtitle">{formatNumero(totalFrutos)} frutos en lotes analizados</p>
          </header>
          <DestinoChart conteo={frutosPorDestinoEjemplo} />
        </article>
      </section>

      <section id="reportes" className="home__section">
        <article className="card">
          <header className="card__header card__header--accion">
            <div>
              <h2 className="card__title">Reportes recientes</h2>
              <p className="card__subtitle">Descarga el PDF de cada lote analizado</p>
            </div>
            <Button variant="plain" onClick={onVerReportes}>
              Ver todos
            </Button>
          </header>
          <ReporteLotes lotes={lotesEjemplo.slice(0, 5)} onDescargar={onDescargarReporte} />
        </article>
      </section>

      <section id="alertas" className="home__section">
        <article className="card">
          <header className="card__header">
            <h2 className="card__title">Alertas de zona</h2>
            <p className="card__subtitle">Defectos repetidos en varios lotes de tu zona en los últimos 7 días</p>
          </header>
          <AlertasZona alertas={alertasEjemplo} />
        </article>
      </section>

      <p className="home__note">Preclasificación visual de fruta. No es una certificación de exportación.</p>
    </div>
  )
}
