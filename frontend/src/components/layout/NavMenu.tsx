import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from '../ui/Icon'
import { NAV_ITEMS, NOMBRE_ROL, type NavId, type Usuario } from './navegacion'

type NavMenuProps = {
  id: string
  open: boolean
  activo: NavId
  usuario: Usuario
  onSelect: (id: NavId) => void
  onLogout: () => void
}

/** Menú desplegable anclado al botón "Menú" del encabezado. */
export function NavMenu({ id, open, activo, usuario, onSelect, onLogout }: NavMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Al abrir, el foco pasa a la opción activa para poder usar el teclado de inmediato
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[aria-current="page"], [role="menuitem"]')?.focus()
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const actual = items.indexOf(document.activeElement as HTMLElement)
    const paso = event.key === 'ArrowDown' ? 1 : -1
    items[(actual + paso + items.length) % items.length]?.focus()
  }

  return (
    <div
      ref={ref}
      id={id}
      className="nav-menu"
      role="menu"
      aria-label="Navegación"
      data-open={open || undefined}
      inert={!open}
      onKeyDown={handleKeyDown}
    >
      <div className="nav-menu__user">
        <span className="nav-menu__avatar" aria-hidden="true">
          {usuario.nombre.charAt(0).toUpperCase()}
        </span>
        <span>
          <span className="nav-menu__name">{usuario.nombre}</span>
          <span className="nav-menu__role">
            {NOMBRE_ROL[usuario.rol]} · {usuario.zona}
          </span>
        </span>
      </div>

      <ul className="nav-menu__list" role="none">
        {NAV_ITEMS.map((item) => (
          <li key={item.id} role="none">
            <button
              type="button"
              role="menuitem"
              className="nav-menu__item"
              aria-current={item.id === activo ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <button type="button" role="menuitem" className="nav-menu__item nav-menu__item--logout" onClick={onLogout}>
        <Icon name="salir" />
        Cerrar sesión
      </button>
    </div>
  )
}
