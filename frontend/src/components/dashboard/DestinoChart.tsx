import { DESTINOS, formatNumero, type Destino } from '../../utils/dominio'

type DestinoChartProps = {
  conteo: Record<Destino, number>
}

/** Barra 100 % apilada + leyenda con cantidades (la leyenda también sirve de tabla). */
export function DestinoChart({ conteo }: DestinoChartProps) {
  const total = DESTINOS.reduce((suma, destino) => suma + conteo[destino.codigo], 0)
  const pct = (valor: number) => (total ? (valor / total) * 100 : 0)

  return (
    <div className="destino-chart">
      <div className="destino-chart__bar" role="img" aria-label="Proporción de frutos por destino; detalle en la lista">
        {DESTINOS.filter((destino) => conteo[destino.codigo] > 0).map((destino) => (
          <span
            key={destino.codigo}
            className="destino-chart__segment"
            data-destino={destino.codigo}
            style={{ flexGrow: conteo[destino.codigo] }}
            title={`${destino.nombre}: ${conteo[destino.codigo]} frutos (${Math.round(pct(conteo[destino.codigo]))}%)`}
          />
        ))}
      </div>

      <ul className="destino-chart__legend">
        {DESTINOS.map((destino) => (
          <li key={destino.codigo}>
            <span className="destino-chart__swatch" data-destino={destino.codigo} aria-hidden="true" />
            <span className="destino-chart__name">{destino.nombre}</span>
            <span className="destino-chart__count">{formatNumero(conteo[destino.codigo])}</span>
            <span className="destino-chart__pct">{Math.round(pct(conteo[destino.codigo]))}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
