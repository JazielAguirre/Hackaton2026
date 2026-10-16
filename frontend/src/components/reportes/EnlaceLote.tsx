import type { MouseEvent, ReactNode } from 'react'
import { navegar } from '../../hooks/useRuta'
import { rutaLote } from '../../utils/reportes'

type EnlaceLoteProps = {
  id: string
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/**
 * Enlace real al detalle (se puede abrir en otra pestaña o copiar).
 * Con clic normal navega sin recargar y recuerda que venimos de la lista,
 * para que "← Reportes" regrese con los mismos filtros y scroll.
 */
export function EnlaceLote({ id, className, children, ...props }: EnlaceLoteProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navegar(rutaLote(id), { estado: { desdeLista: true } })
  }

  return (
    <a href={rutaLote(id)} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
