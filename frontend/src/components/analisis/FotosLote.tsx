import { useRef, type ChangeEvent } from 'react'
import { MAX_FOTOS, type FotoLocal } from '../../utils/fotos'
import { Icon } from '../ui/Icon'

type FotosLoteProps = {
  fotos: FotoLocal[]
  onAgregar: (files: File[]) => void
  onQuitar: (id: string) => void
  error?: string
}

export function FotosLote({ fotos, onAgregar, onQuitar, error }: FotosLoteProps) {
  const camaraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const lleno = fotos.length >= MAX_FOTOS

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = '' // permite volver a elegir la misma foto
    if (files.length) onAgregar(files)
  }

  return (
    <div className="fotos-lote">
      <div className="fotos-lote__header">
        <span className="field__label">Fotos del lote</span>
        <span className="fotos-lote__count" aria-live="polite">
          {fotos.length} de {MAX_FOTOS}
        </span>
      </div>

      <div className="fotos-lote__actions">
        {/* capture="environment" abre la cámara trasera del celular; en computadora abre archivos */}
        <input ref={camaraRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={handleChange} />
        <input ref={galeriaRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleChange} />
        <button type="button" className="foto-action foto-action--primary" disabled={lleno} onClick={() => camaraRef.current?.click()}>
          <Icon name="camara" size={22} />
          Tomar foto
        </button>
        <button type="button" className="foto-action" disabled={lleno} onClick={() => galeriaRef.current?.click()}>
          <Icon name="galeria" size={22} />
          Subir de galería
        </button>
      </div>

      {fotos.length > 0 && (
        <ul className="fotos-lote__grid">
          {fotos.map((foto, index) => (
            <li key={foto.id} className="foto-thumb">
              <img src={foto.url} alt={`Foto ${index + 1} del lote`} />
              <button type="button" className="foto-thumb__remove" aria-label={`Quitar foto ${index + 1}`} onClick={() => onQuitar(foto.id)}>
                <Icon name="cerrar" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="field__message field__message--error" role="alert">
          {error}
        </p>
      ) : (
        <ul className="fotos-lote__tips">
          <li>Buena luz y frutos sin encimarse.</li>
          <li>Junta al menos 30 frutos entre todas las fotos para un grado confiable.</li>
          <li>JPG, PNG o WebP de hasta 10 MB cada una.</li>
        </ul>
      )}
    </div>
  )
}
