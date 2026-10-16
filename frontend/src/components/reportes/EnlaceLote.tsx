import type { ReactNode } from 'react'
import { rutaLote } from '../../utils/reportes'
import { Enlace } from '../ui/Enlace'

type EnlaceLoteProps = {
  id: string
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/** Enlace al detalle de un lote; "← Reportes" regresa con los mismos filtros y scroll. */
export function EnlaceLote({ id, ...props }: EnlaceLoteProps) {
  return <Enlace href={rutaLote(id)} {...props} />
}
