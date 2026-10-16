import type { MouseEvent, ReactNode } from 'react'
import { navegar } from '../../hooks/useRuta'

type EnlaceProps = {
  href: string
  className?: string
  children: ReactNode
  title?: string
  'aria-label'?: string
}

/**
 * Enlace real (se puede abrir en otra pestaña o copiar). Con clic normal navega sin recargar
 * y recuerda que venimos de una lista, para que "atrás" regrese con sus filtros y su scroll.
 */
export function Enlace({ href, className, children, ...props }: EnlaceProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navegar(href, { estado: { desdeLista: true } })
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
