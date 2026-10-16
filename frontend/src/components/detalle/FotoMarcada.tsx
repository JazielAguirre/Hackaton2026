import { useState } from 'react'
import { NOMBRE_DESTINO, SIMBOLO_DESTINO, type Destino, type FotoDetalle, type FrutoDetalle } from '../../utils/dominio'

type FotoMarcadaProps = {
  foto: FotoDetalle
  /** Frutos detectados en esta foto. */
  frutos: FrutoDetalle[]
  numeros: Map<string, number>
  alt: string
  seleccionado: string | null
  resaltado: Destino | null
  onSeleccionar: (fruto: FrutoDetalle) => void
  /** En el visor la imagen se carga de inmediato; en la página, cuando se acerca a la pantalla. */
  carga?: 'lazy' | 'eager'
}

/**
 * Foto con un marcador por fruto, dibujado con la caja que guardó el detector
 * (coordenadas de 0 a 1, así el marcador sigue al fruto a cualquier tamaño).
 */
export function FotoMarcada({ foto, frutos, numeros, alt, seleccionado, resaltado, onSeleccionar, carga = 'lazy' }: FotoMarcadaProps) {
  const [cargada, setCargada] = useState(false)
  const [error, setError] = useState(false)
  const proporcion = foto.ancho && foto.alto ? `${foto.ancho} / ${foto.alto}` : '4 / 3'

  return (
    <div className="foto-marcada" style={{ aspectRatio: proporcion }} data-cargada={cargada || undefined}>
      {foto.url && !error ? (
        <img
          className="foto-marcada__img"
          src={foto.url}
          alt={alt}
          loading={carga}
          decoding="async"
          draggable={false}
          onLoad={() => setCargada(true)}
          onError={() => setError(true)}
        />
      ) : (
        <p className="foto-marcada__error">No pudimos cargar esta foto.</p>
      )}

      {cargada &&
        frutos.map((fruto) => {
          const numero = numeros.get(fruto.id) ?? 0
          const atenuado = resaltado !== null && fruto.destino !== resaltado
          return (
            <button
              key={fruto.id}
              type="button"
              className="foto-marcada__marca"
              data-destino-borde={fruto.destino}
              data-seleccionado={fruto.id === seleccionado || undefined}
              data-atenuado={atenuado || undefined}
              style={{
                left: `${fruto.caja_x * 100}%`,
                top: `${fruto.caja_y * 100}%`,
                width: `${fruto.caja_ancho * 100}%`,
                height: `${fruto.caja_alto * 100}%`,
              }}
              aria-label={`Fruto ${numero}: ${fruto.clase?.nombre ?? 'sin clasificar'}, ${NOMBRE_DESTINO[fruto.destino]}`}
              aria-pressed={fruto.id === seleccionado}
              onClick={(event) => {
                event.stopPropagation()
                onSeleccionar(fruto)
              }}
            >
              <span className="foto-marcada__etiqueta" data-destino={fruto.destino}>
                {SIMBOLO_DESTINO[fruto.destino] ?? ''}
                {numero}
              </span>
            </button>
          )
        })}
    </div>
  )
}
