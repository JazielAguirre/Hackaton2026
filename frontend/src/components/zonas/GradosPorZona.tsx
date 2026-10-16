import { GRADOS, NOMBRE_GRADO, type Grado } from '../../utils/dominio'
import { rutaZona, type ResumenZona } from '../../utils/zonas'
import { Enlace } from '../ui/Enlace'

type GradosPorZonaProps = {
  resumenes: ResumenZona[]
}

const LETRA: Record<Grado, string> = { A: 'A', B: 'B', C: 'C', rechazo: '✕' }

const descripcion = (r: ResumenZona) =>
  `${r.zona.nombre}: ` + GRADOS.map((g) => `${r.porGrado[g]} ${NOMBRE_GRADO[g].toLowerCase()}`).join(', ')

/**
 * Barras 100 % apiladas: cómo se reparten los grados de los lotes en cada zona.
 * Orden fijo de colores (A, B, C, Rechazo); la leyenda y la tabla hacen que no dependa del color.
 */
export function GradosPorZona({ resumenes }: GradosPorZonaProps) {
  const conDatos = resumenes.filter((r) => r.analizados > 0)
  const total = Object.fromEntries(GRADOS.map((g) => [g, conDatos.reduce((s, r) => s + r.porGrado[g], 0)])) as Record<Grado, number>

  if (!conDatos.length) return <p className="empty">Todavía no hay lotes analizados en ninguna zona.</p>

  return (
    <div className="grafica-zonas">
      <ul className="grafica-zonas__leyenda" aria-label="Grados">
        {GRADOS.map((g) => (
          <li key={g} data-grado={g}>
            <span className="grafica-zonas__muestra" aria-hidden="true">
              {LETRA[g]}
            </span>
            {NOMBRE_GRADO[g]}
            <span className="grafica-zonas__total">{total[g]}</span>
          </li>
        ))}
      </ul>

      <ul className="grafica-zonas__filas">
        {conDatos.map((r) => (
          <li key={r.zona.id} className="grafica-zonas__fila">
            <Enlace href={rutaZona(r.zona.id)} className="grafica-zonas__nombre">
              {r.zona.nombre}
            </Enlace>
            <div className="grafica-zonas__barra" role="img" aria-label={descripcion(r)} title={descripcion(r)}>
              {GRADOS.filter((g) => r.porGrado[g] > 0).map((g) => {
                const pct = (100 * r.porGrado[g]) / r.analizados
                return (
                  <span
                    key={g}
                    className="grafica-zonas__segmento"
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
            <span className="grafica-zonas__lotes">
              {r.analizados} {r.analizados === 1 ? 'lote' : 'lotes'}
            </span>
          </li>
        ))}
      </ul>

      <details className="grafica-zonas__tabla">
        <summary>Ver como tabla</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Zona</th>
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
              <tr key={r.zona.id}>
                <th scope="row">{r.zona.nombre}</th>
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
