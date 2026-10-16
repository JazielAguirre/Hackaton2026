import { DESTINOS, formatNumero, SIMBOLO_DESTINO, type Destino, type FrutoDetalle } from '../../utils/dominio'

type MapaFrutosProps = {
  frutos: FrutoDetalle[]
  numeros: Map<string, number>
  seleccionado: string | null
  resaltado: Destino | null
  onSeleccionar: (fruto: FrutoDetalle) => void
  onResaltar: (destino: Destino | null) => void
}

/**
 * "Mapa de la charola": un círculo por fruto, en el mismo orden que sus números en las fotos.
 * La leyenda filtra: tocar un destino resalta solo esos frutos.
 */
export function MapaFrutos({ frutos, numeros, seleccionado, resaltado, onSeleccionar, onResaltar }: MapaFrutosProps) {
  const conteo = new Map<Destino, number>()
  for (const f of frutos) conteo.set(f.destino, (conteo.get(f.destino) ?? 0) + 1)
  const presentes = DESTINOS.filter((d) => conteo.has(d.codigo))

  return (
    <div className="mapa-frutos">
      <div className="mapa-frutos__leyenda" role="group" aria-label="Resaltar frutos por destino">
        {presentes.map((d) => (
          <button
            key={d.codigo}
            type="button"
            className="chip chip--destino"
            aria-pressed={resaltado === d.codigo}
            onClick={() => onResaltar(resaltado === d.codigo ? null : d.codigo)}
          >
            <span className="chip__punto" data-destino={d.codigo} aria-hidden="true">
              {SIMBOLO_DESTINO[d.codigo]}
            </span>
            {d.nombre}
            <span className="chip__conteo">{formatNumero(conteo.get(d.codigo) ?? 0)}</span>
          </button>
        ))}
      </div>

      <ol className="mapa-frutos__rejilla" aria-label="Frutos del lote">
        {frutos.map((fruto) => {
          const numero = numeros.get(fruto.id) ?? 0
          return (
            <li key={fruto.id}>
              <button
                type="button"
                className="mapa-frutos__fruto"
                data-destino={fruto.destino}
                data-seleccionado={fruto.id === seleccionado || undefined}
                data-atenuado={(resaltado !== null && fruto.destino !== resaltado) || undefined}
                aria-pressed={fruto.id === seleccionado}
                aria-label={`Fruto ${numero}: ${fruto.clase?.nombre ?? 'sin clasificar'}`}
                title={`Fruto ${numero}: ${fruto.clase?.nombre ?? 'sin clasificar'}`}
                onClick={() => onSeleccionar(fruto)}
              >
                {SIMBOLO_DESTINO[fruto.destino] ?? numero}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
