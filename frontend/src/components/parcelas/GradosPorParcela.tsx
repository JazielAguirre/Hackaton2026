import { GRADOS, NOMBRE_GRADO, type Grado } from '../../utils/dominio'
import { rutaParcela, type ResumenParcela } from '../../utils/parcelas'
import { Enlace } from '../ui/Enlace'

type GradosPorParcelaProps = {
  resumenes: ResumenParcela[]
}

const LETRA: Record<Grado, string> = { A: 'A', B: 'B', C: 'C', rechazo: '✕' }

const descripcion = (r: ResumenParcela) =>
  `${r.parcela.nombre}: ` + GRADOS.map((g) => `${r.porGrado[g]} ${NOMBRE_GRADO[g].toLowerCase()}`).join(', ')

/**
 * Barras 100 % apiladas: cómo se reparten los grados de los lotes en cada parcela.
 * Orden fijo de colores (A, B, C, Rechazo); la leyenda y la tabla hacen que no dependa del color.
 */
export function GradosPorParcela({ resumenes }: GradosPorParcelaProps) {
  const conDatos = resumenes.filter((r) => r.analizados > 0)
  const total = Object.fromEntries(GRADOS.map((g) => [g, conDatos.reduce((s, r) => s + r.porGrado[g], 0)])) as Record<Grado, number>

  if (!conDatos.length) return <p className="empty">Todavía no hay lotes analizados en ninguna parcela.</p>

  return (
    <div className="grafica-parcelas">
      <ul className="grafica-parcelas__leyenda" aria-label="Grados">
        {GRADOS.map((g) => (
          <li key={g} data-grado={g}>
            <span className="grafica-parcelas__muestra" aria-hidden="true">
              {LETRA[g]}
            </span>
            {NOMBRE_GRADO[g]}
            <span className="grafica-parcelas__total">{total[g]}</span>
          </li>
        ))}
      </ul>

      <ul className="grafica-parcelas__filas">
        {conDatos.map((r) => (
          <li key={r.parcela.id} className="grafica-parcelas__fila">
            <Enlace href={rutaParcela(r.parcela.id)} className="grafica-parcelas__nombre">
              {r.parcela.nombre}
            </Enlace>
            <div className="grafica-parcelas__barra" role="img" aria-label={descripcion(r)} title={descripcion(r)}>
              {GRADOS.filter((g) => r.porGrado[g] > 0).map((g) => {
                const pct = (100 * r.porGrado[g]) / r.analizados
                return (
                  <span
                    key={g}
                    className="grafica-parcelas__segmento"
                    data-grado={g}
                    style={{ flexGrow: r.porGrado[g] }}
                    title={`${NOMBRE_GRADO[g]}: ${r.porGrado[g]} de ${r.analizados} lotes (${Math.round(pct)}%)`}
                  >
                    {/* Etiqueta directa solo si cabe; si no, la cifra queda en la tabla y en el tooltip */}
                    {pct >= 14 && `${LETRA[g]} ${r.porGrado[g]}`}
                  </span>
                )
              })}
            </div>
            <span className="grafica-parcelas__lotes">
              {r.analizados} {r.analizados === 1 ? 'lote' : 'lotes'}
            </span>
          </li>
        ))}
      </ul>

      <details className="grafica-parcelas__tabla">
        <summary>Ver como tabla</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Parcela</th>
              {GRADOS.map((g) => (
                <th key={g} scope="col">
                  {NOMBRE_GRADO[g]}
                </th>
              ))}
              <th scope="col">Lotes</th>
            </tr>
          </thead>
          <tbody>
            {conDatos.map((r) => (
              <tr key={r.parcela.id}>
                <th scope="row">{r.parcela.nombre}</th>
                {GRADOS.map((g) => (
                  <td key={g}>{r.porGrado[g]}</td>
                ))}
                <td>{r.analizados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
