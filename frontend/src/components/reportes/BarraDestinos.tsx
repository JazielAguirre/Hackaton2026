import { DESTINOS, formatNumero, type Destino } from '../../utils/dominio'

// Nombres cortos para la leyenda de las tarjetas
const CORTO: Record<Destino, string> = {
  exportacion: 'exportación',
  mercado_nacional: 'nacional',
  procesamiento: 'procesamiento',
  separar: 'separar',
  revision_manual: 'revisión',
}

type BarraDestinosProps = {
  conteo: Record<Destino, number>
  /** Muestra debajo la leyenda en una línea de texto ("52 exportación · 2 separar"). */
  leyenda?: boolean
}

/** Mini barra apilada de destinos. La leyenda en texto hace que no dependa del color. */
export function BarraDestinos({ conteo, leyenda = true }: BarraDestinosProps) {
  const presentes = DESTINOS.filter((d) => conteo[d.codigo] > 0)
  const texto = presentes.map((d) => `${formatNumero(conteo[d.codigo])} ${CORTO[d.codigo]}`).join(' · ')

  return (
    <div className="barra-destinos">
      <div className="barra-destinos__barra" aria-hidden="true">
        {presentes.map((d) => (
          <span key={d.codigo} data-destino={d.codigo} style={{ flexGrow: conteo[d.codigo] }} />
        ))}
      </div>
      {leyenda && (
        <p className="barra-destinos__leyenda">
          <span className="sr-only">Frutos por destino: </span>
          {texto}
        </p>
      )}
    </div>
  )
}
