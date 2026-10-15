import { formatFecha, formatPct, NOMBRE_FRUTA, NOMBRE_GRADO, type LoteBitacora } from '../../utils/dominio'
import { Icon } from '../ui/Icon'

type ReporteLotesProps = {
  lotes: LoteBitacora[]
  onDescargar: (lote: LoteBitacora) => void
}

export function ReporteLotes({ lotes, onDescargar }: ReporteLotesProps) {
  return (
    <ul className="reportes">
      {lotes.map((lote) => {
        const grado = lote.estado === 'analizado' ? lote.grado : null
        return (
          <li key={lote.id} className="reporte">
            <div className="reporte__main">
              <p className="reporte__title">
                {lote.nombre}
                <span className="reporte__meta"> · {NOMBRE_FRUTA[lote.fruta_principal ?? ''] ?? 'Fruta'}</span>
              </p>
              <p className="reporte__meta">
                {lote.parcela} · {formatFecha(lote.analizado_at ?? lote.created_at)}
                {grado && ` · ${lote.total_frutos} frutos · ${formatPct(lote.pct_sanos)} sanos`}
              </p>
              {lote.muestra_pequena && <p className="reporte__note">Muestra pequeña: menos de 30 frutos.</p>}
            </div>

            {grado ? (
              <>
                <span className="grado-badge" data-grado={grado}>
                  {NOMBRE_GRADO[grado]}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Descargar reporte PDF de ${lote.nombre}`}
                  title="Descargar PDF"
                  onClick={() => onDescargar(lote)}
                >
                  <Icon name="descargar" />
                </button>
              </>
            ) : (
              <span className="grado-badge grado-badge--pendiente">Analizando…</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
