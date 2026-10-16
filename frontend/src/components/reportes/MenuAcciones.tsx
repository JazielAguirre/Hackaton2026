import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, type IconName } from '../ui/Icon'

export type Accion = {
  etiqueta: string
  icono: IconName
  onSelect: () => void
}

type MenuAccionesProps = {
  acciones: readonly Accion[]
  /** Contenido del botón. Si no hay, se muestra "⋯" con `etiqueta` como nombre accesible. */
  children?: ReactNode
  etiqueta: string
  className?: string
}

/** Menú pequeño que nace del botón que lo abre. Escape o tocar fuera lo cierran; flechas para moverse. */
export function MenuAcciones({ acciones, children, etiqueta, className }: MenuAccionesProps) {
  const [abierto, setAbierto] = useState(false)
  const menuId = useId()
  const raizRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    raizRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAbierto(false)
        botonRef.current?.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (!raizRef.current?.contains(event.target as Node)) setAbierto(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [abierto])

  function moverFoco(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(raizRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const actual = items.indexOf(document.activeElement as HTMLElement)
    items[(actual + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div ref={raizRef} className={`menu-acciones ${className ?? ''}`} data-open={abierto || undefined}>
      <button
        ref={botonRef}
        type="button"
        className={children ? 'button button--secundario' : 'icon-button menu-acciones__puntos'}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={menuId}
        aria-label={children ? undefined : etiqueta}
        title={children ? undefined : etiqueta}
        onClick={(event) => {
          // El menú vive dentro de tarjetas que son enlaces: no abrir el detalle
          event.preventDefault()
          event.stopPropagation()
          setAbierto((prev) => !prev)
        }}
      >
        {children ?? <Icon name="opciones" size={22} />}
      </button>

      <div id={menuId} className="menu-acciones__lista" role="menu" aria-label={etiqueta} inert={!abierto} onKeyDown={moverFoco}>
        {acciones.map((accion) => (
          <button
            key={accion.etiqueta}
            type="button"
            role="menuitem"
            className="menu-acciones__item"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setAbierto(false)
              accion.onSelect()
            }}
          >
            <Icon name={accion.icono} />
            {accion.etiqueta}
          </button>
        ))}
      </div>
    </div>
  )
}
