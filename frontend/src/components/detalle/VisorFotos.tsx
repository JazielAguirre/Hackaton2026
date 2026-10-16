import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Destino, FotoDetalle, FrutoDetalle } from '../../utils/dominio'
import { Icon } from '../ui/Icon'
import { FotoMarcada } from './FotoMarcada'

type VisorFotosProps = {
  abierto: boolean
  fotos: FotoDetalle[]
  indice: number
  frutos: FrutoDetalle[]
  numeros: Map<string, number>
  altFoto: (indice: number) => string
  seleccionado: string | null
  resaltado: Destino | null
  onSeleccionar: (fruto: FrutoDetalle) => void
  onCambiar: (indice: number) => void
  onCerrar: () => void
  /** Resultado del fruto elegido; el visor tapa la página, así que se muestra aquí mismo. */
  detalle?: ReactNode
}

const ZOOMS = [1, 1.5, 2, 3] as const
const UMBRAL_DESLIZAR = 60 // px para pasar de foto
const HISTERESIS = 10 // px antes de decidir que es un arrastre y no un toque

/**
 * Visor a pantalla completa (<dialog> nativo: atrapa el foco y cierra con Escape).
 * Celular: deslizar para cambiar de foto, el dedo arrastra la foto 1:1.
 * Escritorio: flechas en pantalla y del teclado; + y − para el zoom.
 * Con zoom, arrastrar mueve la foto en vez de cambiarla.
 */
export function VisorFotos(props: VisorFotosProps) {
  const { abierto, fotos, indice, frutos, numeros, altFoto, seleccionado, resaltado, onSeleccionar, onCambiar, onCerrar, detalle } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const gesto = useRef<{ x: number; y: number; baseX: number; baseY: number; activo: boolean } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  // Cada foto empieza sin zoom (se ajusta durante el render, sin efecto)
  const [indiceVisto, setIndiceVisto] = useState(indice)
  if (indiceVisto !== indice) {
    setIndiceVisto(indice)
    setZoom(1)
    setDesplazamiento({ x: 0, y: 0 })
  }

  const hay = fotos.length > 1
  const ir = (paso: number) => {
    if (!hay) return
    onCambiar((indice + paso + fotos.length) % fotos.length)
  }

  function cambiarZoom(paso: number) {
    const actual = ZOOMS.findIndex((z) => z >= zoom)
    const siguiente = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, actual + paso))]
    setZoom(siguiente)
    if (siguiente === 1) setDesplazamiento({ x: 0, y: 0 })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowRight') ir(1)
    else if (event.key === 'ArrowLeft') ir(-1)
    else if (event.key === '+' || event.key === '=') cambiarZoom(1)
    else if (event.key === '-') cambiarZoom(-1)
    else return
    event.preventDefault()
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    gesto.current = { x: event.clientX, y: event.clientY, baseX: desplazamiento.x, baseY: desplazamiento.y, activo: false }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesto.current
    if (!g) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (!g.activo) {
      if (Math.hypot(dx, dy) < HISTERESIS) return
      g.activo = true
      setArrastrando(true)
      // Captura hasta soltar: el arrastre sigue aunque el dedo salga de la foto
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    // Con zoom se mueve la foto; sin zoom solo en horizontal, para cambiar de foto
    setDesplazamiento(zoom > 1 ? { x: g.baseX + dx, y: g.baseY + dy } : { x: hay ? dx : dx * 0.3, y: 0 })
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesto.current
    gesto.current = null
    if (!g?.activo) return
    setArrastrando(false)
    if (zoom > 1) return
    const dx = event.clientX - g.x
    setDesplazamiento({ x: 0, y: 0 })
    if (Math.abs(dx) > UMBRAL_DESLIZAR) ir(dx < 0 ? 1 : -1)
  }

  const foto = fotos[indice]
  const frutosFoto = foto ? frutos.filter((f) => f.foto_id === foto.id) : []

  return (
    <dialog
      ref={dialogRef}
      className="visor"
      aria-label="Fotos del lote"
      onClose={onCerrar}
      onKeyDown={onKeyDown}
      // Tocar el fondo oscuro cierra el visor
      onClick={(event) => event.target === event.currentTarget && onCerrar()}
    >
      <div className="visor__barra">
        <p className="visor__contador" aria-live="polite">
          {hay ? `Foto ${indice + 1} de ${fotos.length}` : 'Foto del lote'}
        </p>
        <div className="visor__zoom">
          <button type="button" className="visor__boton" onClick={() => cambiarZoom(-1)} disabled={zoom === 1} aria-label="Alejar">
            <Icon name="alejar" />
          </button>
          <span className="visor__nivel">{Math.round(zoom * 100)}%</span>
          <button type="button" className="visor__boton" onClick={() => cambiarZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Acercar">
            <Icon name="acercar" />
          </button>
        </div>
        <button type="button" className="visor__boton" onClick={onCerrar} aria-label="Cerrar visor">
          <Icon name="cerrar" />
        </button>
      </div>

      <div
        className="visor__escena"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (zoom > 1 ? (setZoom(1), setDesplazamiento({ x: 0, y: 0 })) : setZoom(2))}
        data-zoom={zoom > 1 || undefined}
      >
        {foto && (
          <div
            className="visor__lienzo"
            data-arrastrando={arrastrando || undefined}
            style={
              {
                transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${zoom})`,
                '--relacion': foto.ancho && foto.alto ? foto.ancho / foto.alto : 4 / 3,
              } as CSSProperties
            }
          >
            <FotoMarcada
              key={foto.id}
              foto={foto}
              frutos={frutosFoto}
              numeros={numeros}
              alt={altFoto(indice)}
              seleccionado={seleccionado}
              resaltado={resaltado}
              onSeleccionar={onSeleccionar}
              carga="eager"
            />
          </div>
        )}

        {hay && (
          <>
            <button type="button" className="visor__flecha visor__flecha--prev" onClick={() => ir(-1)} aria-label="Foto anterior">
              <Icon name="regresar" size={24} />
            </button>
            <button type="button" className="visor__flecha visor__flecha--next" onClick={() => ir(1)} aria-label="Foto siguiente">
              <Icon name="siguiente" size={24} />
            </button>
          </>
        )}
      </div>

      {detalle ?? (
        <p className="visor__ayuda">
          {hay ? 'Desliza o usa las flechas para cambiar de foto. ' : ''}Toca un fruto para ver su resultado.
        </p>
      )}
    </dialog>
  )
}
