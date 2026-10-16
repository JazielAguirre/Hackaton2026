import type { IconName } from '../ui/Icon'

/** Pantallas de la app. Reportes es también la bitácora; las alertas viven en Inicio y en cada zona. */
export type Vista = 'inicio' | 'nuevo' | 'reportes' | 'zonas'
export type NavId = Vista

export type Usuario = {
  nombre: string
  rol: 'productor' | 'acopio' | 'tecnico'
  zona: string
}

export const NAV_ITEMS: readonly { id: NavId; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'inicio' },
  { id: 'nuevo', label: 'Nuevo análisis', icon: 'camara' },
  { id: 'reportes', label: 'Reportes y bitácora', icon: 'reporte' },
  { id: 'zonas', label: 'Zonas', icon: 'zona' },
]

export const NOMBRE_ROL: Record<Usuario['rol'], string> = {
  productor: 'Productor',
  acopio: 'Centro de acopio',
  tecnico: 'Técnico',
}
