import { GRADOS, NOMBRE_GRADO, type Grado } from '../../utils/dominio'

type GradoChartProps = {
  conteo: Record<Grado, number>
}

/** Barras horizontales: cuántos lotes quedaron en cada grado. Cada barra lleva el color de su grado (el mismo en toda la app). */
export function GradoChart({ conteo }: GradoChartProps) {
  const max = Math.max(1, ...GRADOS.map((grado) => conteo[grado]))

  return (
    <ul className="bar-chart">
      {GRADOS.map((grado) => {
        const valor = conteo[grado]
        return (
          <li key={grado} className="bar-chart__row" title={`${NOMBRE_GRADO[grado]}: ${valor} lotes`}>
            <span className="bar-chart__label">{NOMBRE_GRADO[grado]}</span>
            <span className="bar-chart__track">
              <span className="bar-chart__bar" data-grado={grado} style={{ inlineSize: `calc((100% - 2.5rem) * ${valor / max})` }} />
              <span className="bar-chart__value">{valor}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
