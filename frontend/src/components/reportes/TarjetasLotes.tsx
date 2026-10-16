import { navegar } from '../../hooks/useRuta'
import { formatFechaLarga, formatFrutos, formatPct, NOMBRE_ESTADO, type LoteReporte } from '../../utils/dominio'
import { nombreCultivo, rutaLote, type Grupo } from '../../utils/reportes'
import { BarraDestinos } from './BarraDestinos'
import { EnlaceLote } from './EnlaceLote'
import { GradoInsignia } from './GradoInsignia'
import { MenuAcciones, type Accion } from './MenuAcciones'

type TarjetasLotesProps = {
  grupos: Grupo[]
  onDescargarPdf: (lote: LoteReporte) => void
}

export function TarjetasLotes({ grupos, onDescargarPdf }: TarjetasLotesProps) {
  return (
    <div className="tarjetas-lotes">
      {grupos.map((grupo) => (
        <section key={grupo.id} className="tarjetas-lotes__grupo" aria-labelledby={`grupo-${grupo.id}`}>
          <h2 id={`grupo-${grupo.id}`} className="lista-grupo">
            {grupo.titulo}
          </h2>
          <ul className="tarjetas-lotes__lista">
            {grupo.lotes.map((lote) => {
              const analizado = lote.estado === 'analizado' && lote.analisis_id !== null
              const titulo = `${nombreCultivo(lote.fruta_principal)} · ${lote.parcela ?? lote.zona_nombre ?? 'Sin parcela'}`
              const acciones: Accion[] = [
                { etiqueta: 'Ver', icono: 'ver', onSelect: () => navegar(rutaLote(lote.id), { estado: { desdeLista: true } }) },
              ]
              if (analizado) acciones.push({ etiqueta: 'Descargar PDF', icono: 'descargar', onSelect: () => onDescargarPdf(lote) })

              return (
                <li key={lote.id} className="tarjeta-lote">
                  <GradoInsignia grado={lote.grado} estado={lote.estado} tamano="lg" />

                  <div className="tarjeta-lote__info">
                    {/* El enlace cubre toda la tarjeta (ver ::after en reportes.css) */}
                    <EnlaceLote id={lote.id} className="tarjeta-lote__titulo">
                      {titulo}
                    </EnlaceLote>
                    <p className="tarjeta-lote__meta">
                      {formatFechaLarga(lote.fecha_cosecha)}
                      {analizado ? ` · ${formatFrutos(lote.total_frutos ?? 0)}` : ` · ${lote.nombre}`}
                    </p>
                  </div>

                  <p className="tarjeta-lote__sanos">
                    {analizado ? (
                      <>
                        <span className="tarjeta-lote__pct">{formatPct(lote.pct_sanos)}</span>
                        <span className="tarjeta-lote__pct-label">sanos</span>
                      </>
                    ) : (
                      <span className="tarjeta-lote__estado">{lote.estado ? NOMBRE_ESTADO[lote.estado] : ''}</span>
                    )}
                  </p>

                  <MenuAcciones className="tarjeta-lote__menu" etiqueta={`Opciones de ${lote.nombre}`} acciones={acciones} />

                  {analizado && lote.frutos_por_destino && (
                    <div className="tarjeta-lote__destinos">
                      <BarraDestinos conteo={lote.frutos_por_destino} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
