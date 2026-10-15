import { useEffect, useId, useRef, useState } from 'react'
import type { Theme } from '../../hooks/useTheme'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NavMenu } from './NavMenu'
import '../../styles/layout.css'
import type { NavId, Usuario } from './navegacion'

type AppHeaderProps = {
  usuario: Usuario
  activo: NavId
  theme: Theme
  onToggleTheme: () => void
  onNavigate: (id: NavId) => void
  onLogout: () => void
}

export function AppHeader({ usuario, activo, theme, onToggleTheme, onNavigate, onLogout }: AppHeaderProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Cierra con Escape o al tocar fuera del menú
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  function select(id: NavId) {
    setOpen(false)
    onNavigate(id)
  }

  return (
    <header className="app-header">
      <button type="button" className="app-header__brand" onClick={() => onNavigate('inicio')}>
        <span className="app-header__logo" aria-hidden="true">
          <Icon name="fruta" size={18} />
        </span>
        FruitScan
      </button>

      <div className="app-header__actions" ref={wrapperRef}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          ref={buttonRef}
          type="button"
          className="app-header__menu-button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Icon name={open ? 'cerrar' : 'menu'} />
          <span>Menú</span>
        </button>
        <NavMenu
          id={menuId}
          open={open}
          activo={activo}
          usuario={usuario}
          onSelect={select}
          onLogout={() => {
            setOpen(false)
            onLogout()
          }}
        />
      </div>
    </header>
  )
}
