import { formatFecha, NOMBRE_CLASE, NOMBRE_FRUTA, type AlertaComunitaria } from '../../utils/dominio'
import { Icon } from '../ui/Icon'

type AlertasZonaProps = {
  alertas: AlertaComunitaria[]
}

export function AlertasZona({ alertas }: AlertasZonaProps) {
  if (alertas.length === 0) {
    return <p className="empty">Sin alertas en tu zona esta semana.</p>
  }

  return (
    <ul className="alertas">
      {alertas.map((alerta) => (
        <li key={`${alerta.zona_id}-${alerta.fruta_id}-${alerta.clase_codigo}`} className="alerta">
          <span className="alerta__icon">
            <Icon name="alerta" />
          </span>
          <div>
            <p className="alerta__title">
              {NOMBRE_CLASE[alerta.clase_codigo] ?? alerta.clase_codigo} en {(NOMBRE_FRUTA[alerta.fruta_id] ?? alerta.fruta_id).toLowerCase()}
            </p>
            <p className="alerta__meta">
              {alerta.lotes_afectados} lotes en {alerta.zona_nombre} · último reporte {formatFecha(alerta.ultimo_reporte)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
