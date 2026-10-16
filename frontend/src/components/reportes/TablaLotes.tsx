import { formatFechaLarga, formatNumero, formatPct, type LoteReporte } from '../../utils/dominio'
import { nombreCultivo, type Columna, type Direccion, type Grupo } from '../../utils/reportes'
import { Icon } from '../ui/Icon'
import { EnlaceLote } from './EnlaceLote'
import { GradoInsignia } from './GradoInsignia'

type TablaLotesProps = {
  grupos: Grupo[]
  orden: Columna
  dir: Direccion
  onOrdenar: (columna: Columna) => void
  onDescargarPdf: (lote: LoteReporte) => void
}

const COLUMNAS: readonly { id: Columna; titulo: string; numerica?: boolean }[] = [
  { id: 'lote', titulo: 'Lote' },
  { id: 'cosecha', titulo: 'Fecha de cosecha' },
  { id: 'cultivo', titulo: 'Cultivo' },
  { id: 'parcela', titulo: 'Parcela o zona' },
  { id: 'frutos', titulo: 'Frutos', numerica: true },
  { id: 'sanos', titulo: '% sanos', numerica: true },
  { id: 'separar', titulo: '% para separar', numerica: true },
  { id: 'grado', titulo: 'Grado' },
]

export function TablaLotes({ grupos, orden, dir, onOrdenar, onDescargarPdf }: TablaLotesProps) {
  return (
    <div className="tabla-lotes">
      <table>
        <caption className="sr-only">Lotes de tu bitácora. Usa los encabezados para ordenar.</caption>
        <thead>
          <tr>
            {COLUMNAS.map((col) => {
              const activa = col.id === orden
              return (
                <th
                  key={col.id}
                  scope="col"
                  className={col.numerica ? 'tabla-lotes__num' : undefined}
                  aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="tabla-lotes__orden" data-activa={activa || undefined} onClick={() => onOrdenar(col.id)}>
                    {col.titulo}
                    <Icon name={activa && dir === 'asc' ? 'arriba' : 'abajo'} size={14} />
                  </button>
                </th>
              )
            })}
            <th scope="col" className="tabla-lotes__acciones">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>

        {grupos.map((grupo) => (
          <tbody key={grupo.id}>
            <tr className="tabla-lotes__grupo">
              <th scope="colgroup" colSpan={COLUMNAS.length + 1}>
                {grupo.titulo}
              </th>
            </tr>
            {grupo.lotes.map((lote) => {
              const analizado = lote.estado === 'analizado' && lote.analisis_id !== null
              return (
                <tr key={lote.id}>
                  <td>
                    <EnlaceLote id={lote.id} className="tabla-lotes__lote">
                      {lote.nombre}
                    </EnlaceLote>
                    <span className="tabla-lotes__sub">#{lote.id.slice(0, 8)}</span>
                  </td>
                  <td>{formatFechaLarga(lote.fecha_cosecha)}</td>
                  <td>{nombreCultivo(lote.fruta_principal)}</td>
                  <td>
                    {lote.parcela ?? '—'}
                    <span className="tabla-lotes__sub">{lote.zona_nombre}</span>
                  </td>
                  <td className="tabla-lotes__num">{analizado ? formatNumero(lote.total_frutos ?? 0) : '—'}</td>
                  <td className="tabla-lotes__num">
                    {analizado ? (
                      <span className="tabla-lotes__pct">
                        {formatPct(lote.pct_sanos)}
                        <span className="mini-barra" aria-hidden="true">
                          <span style={{ inlineSize: `${lote.pct_sanos ?? 0}%` }} />
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabla-lotes__num">{analizado ? formatPct(lote.pct_separar) : '—'}</td>
                  <td>
                    <GradoInsignia grado={lote.grado} estado={lote.estado} conTexto={!analizado} />
                  </td>
                  <td className="tabla-lotes__acciones">
                    <EnlaceLote id={lote.id} className="tabla-lotes__accion" aria-label={`Ver ${lote.nombre}`}>
                      <Icon name="ver" size={18} />
                      Ver
                    </EnlaceLote>
                    {analizado && (
                      <button
                        type="button"
                        className="tabla-lotes__accion"
                        aria-label={`Descargar PDF de ${lote.nombre}`}
                        onClick={() => onDescargarPdf(lote)}
                      >
                        <Icon name="descargar" size={18} />
                        PDF
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
