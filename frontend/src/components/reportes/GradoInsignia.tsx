import { NOMBRE_ESTADO, NOMBRE_GRADO, type Grado, type LoteBitacora } from '../../utils/dominio'

type GradoInsigniaProps = {
  grado: Grado | null
  /** Para explicar por qué no hay grado (borrador, analizando, error). */
  estado?: LoteBitacora['estado']
  tamano?: 'sm' | 'md' | 'lg'
  /** Muestra el nombre del grado junto al círculo; si no, va solo para lectores de pantalla. */
  conTexto?: boolean
}

/** Círculo con la letra del grado (✕ en rechazo). El color refuerza; el texto lleva el significado. */
export function GradoInsignia({ grado, estado, tamano = 'md', conTexto = false }: GradoInsigniaProps) {
  const nombre = grado ? NOMBRE_GRADO[grado] : estado && estado !== 'analizado' ? NOMBRE_ESTADO[estado] : 'Sin grado'
  const letra = grado === 'rechazo' ? '✕' : (grado ?? '–')

  return (
    <span className={`grado-insignia grado-insignia--${tamano}`} data-grado={grado ?? 'ninguno'}>
      <span className="grado-insignia__circulo" aria-hidden="true">
        {letra}
      </span>
      <span className={conTexto ? 'grado-insignia__texto' : 'sr-only'}>{nombre}</span>
    </span>
  )
}
