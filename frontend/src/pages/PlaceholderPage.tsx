import { Button } from '../components/ui/Button'
import { Icon, type IconName } from '../components/ui/Icon'

type PlaceholderPageProps = {
  titulo: string
  icon: IconName
  onVolver: () => void
}

/** Pantalla provisional para secciones que todavía se están diseñando. */
export function PlaceholderPage({ titulo, icon, onVolver }: PlaceholderPageProps) {
  return (
    <div className="placeholder">
      <span className="placeholder__icon">
        <Icon name={icon} size={28} />
      </span>
      <h1 className="placeholder__title">{titulo}</h1>
      <p className="placeholder__text">Esta sección está en diseño.</p>
      <Button variant="plain" onClick={onVolver}>
        Volver al inicio
      </Button>
    </div>
  )
}
