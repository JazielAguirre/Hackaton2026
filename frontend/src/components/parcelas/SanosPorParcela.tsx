import { formatNumero, formatPct } from '../../utils/dominio'
import { rutaParcela, type ResumenParcela } from '../../utils/parcelas'
import { Enlace } from '../ui/Enlace'

type SanosPorParcelaProps = {
  resumenes: ResumenParcela[]
}

/**
 * Una sola medida (% de frutos sanos) → barras horizontales de un solo color, de mayor a menor.
 * El valor va escrito al final de cada barra; la escala siempre es de 0 a 100 %.
 */
export function SanosPorParcela({ resumenes }: SanosPorParcelaProps) {
  const filas = resumenes.filter((r) => r.pctSanos !== null).sort((a, b) => (b.pctSanos ?? 0) - (a.pctSanos ?? 0))
  if (!filas.length) return <p className="empty">Todavía no hay frutos analizados.</p>

  return (
    <ul className="bar-chart sanos-parcela">
      {filas.map((r) => (
        <li
          key={r.parcela.id}
          className="bar-chart__row sanos-parcela__fila"
          title={`${r.parcela.nombre}: ${formatPct(r.pctSanos)} sanos de ${formatNumero(r.frutosClasificados)} frutos`}
        >
          <Enlace href={rutaParcela(r.parcela.id)} className="bar-chart__label sanos-parcela__nombre">
            {r.parcela.nombre}
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
