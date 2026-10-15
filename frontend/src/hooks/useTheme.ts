import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export type Theme = 'light' | 'dark'

// Misma clave que usa el script de index.html para evitar el destello al cargar
const STORAGE_KEY = 'fruitscan-tema'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/** Tema claro/oscuro: sigue al sistema hasta que la persona elige uno. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? (darkQuery().matches ? 'dark' : 'light'))

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    const query = darkQuery()
    const onChange = (event: MediaQueryListEvent) => {
      if (!readStored()) setTheme(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // sin almacenamiento (modo privado): el cambio dura solo esta visita
    }

    const update = () => {
      flushSync(() => setTheme(next))
      applyTheme(next)
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // View Transitions hace un fundido entre ambos temas; si no existe, cambia directo
    if (!document.startViewTransition || reduceMotion) update()
    else document.startViewTransition(update)
  }

  return { theme, toggleTheme }
}
