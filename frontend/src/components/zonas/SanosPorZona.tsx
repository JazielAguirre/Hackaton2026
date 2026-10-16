import { formatNumero, formatPct } from '../../utils/dominio'
import { rutaZona, type ResumenZona } from '../../utils/zonas'
import { Enlace } from '../ui/Enlace'

type SanosPorZonaProps = {
  resumenes: ResumenZona[]
}

/**
 * Una sola medida (% de frutos sanos) → barras horizontales de un solo color, de mayor a menor.
 * El valor va escrito al final de cada barra; la escala siempre es de 0 a 100 %.
 */
export function SanosPorZona({ resumenes }: SanosPorZonaProps) {
  const filas = resumenes.filter((r) => r.pctSanos !== null).sort((a, b) => (b.pctSanos ?? 0) - (a.pctSanos ?? 0))
  if (!filas.length) return <p className="empty">Todavía no hay frutos analizados.</p>

  return (
    <ul className="bar-chart sanos-zona">
      {filas.map((r) => (
        <li
          key={r.zona.id}
          className="bar-chart__row sanos-zona__fila"
          title={`${r.zona.nombre}: ${formatPct(r.pctSanos)} sanos de ${formatNumero(r.frutosClasificados)} frutos`}
        >
          <Enlace href={rutaZona(r.zona.id)} className="bar-chart__label sanos-zona__nombre">
            {r.zona.nombre}
          </Enlace>
          <span className="bar-chart__track">
            <span className="bar-chart__bar" style={{ inlineSize: `calc((100% - 3rem) * ${(r.pctSanos ?? 0) / 100})` }} />
            <span className="bar-chart__value">{formatPct(r.pctSanos)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
