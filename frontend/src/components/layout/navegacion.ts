import type { IconName } from '../ui/Icon'

/** Pantallas propias de la app. Reportes y alertas son secciones de inicio. */
export type Vista = 'inicio' | 'nuevo' | 'bitacora'
export type NavId = Vista | 'reportes' | 'alertas'

export type Usuario = {
  nombre: string
  rol: 'productor' | 'acopio' | 'tecnico'
  zona: string
}

export const NAV_ITEMS: readonly { id: NavId; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'inicio' },
  { id: 'nuevo', label: 'Nuevo análisis', icon: 'camara' },
  { id: 'bitacora', label: 'Bitácora', icon: 'bitacora' },
  { id: 'reportes', label: 'Reportes', icon: 'reporte' },
  { id: 'alertas', label: 'Alertas de zona', icon: 'alerta' },
]

export const NOMBRE_ROL: Record<Usuario['rol'], string> = {
  productor: 'Productor',
  acopio: 'Centro de acopio',
  tecnico: 'Técnico',
}
