import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FotosLote } from '../components/analisis/FotosLote'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { TextField } from '../components/ui/TextField'
import { validarFotos, type FotoLocal } from '../utils/fotos'
import '../styles/nuevo-analisis.css'

/**
 * Lo que la página entrega para crear el lote (POST /lotes) y subir sus fotos (POST /lotes/{id}/fotos).
 * La fruta la identifica el detector; el nombre del lote se genera solo.
 */
export type NuevoLote = {
  nombre: string
  parcela: string | null
  fecha_cosecha: string
  fotos: File[]
}

type NuevoAnalisisPageProps = {
  /** Parcelas del productor para el select (sin repetir). */
  parcelas: readonly string[]
  onSubmit: (lote: NuevoLote) => Promise<void>
  onCancelar: () => void
}

/** Fecha local en formato AAAA-MM-DD (no UTC, para que no cambie de día en la noche). */
function fechaLocal(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const formatoNombre = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export function NuevoAnalisisPage({ parcelas, onSubmit, onCancelar }: NuevoAnalisisPageProps) {
  const [parcela, setParcela] = useState('')
  const [hoy] = useState(() => fechaLocal(new Date()))
  const [fechaCosecha, setFechaCosecha] = useState(hoy)
  const [fotos, setFotos] = useState<FotoLocal[]>([])
  const [errorFotos, setErrorFotos] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const [formError, setFormError] = useState<string>()

  // Libera las vistas previas al salir de la página
  const fotosRef = useRef(fotos)
  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])
  useEffect(() => () => fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.url)), [])

  function agregarFotos(files: File[]) {
    const { aceptadas, errores } = validarFotos(files, fotos.length)
    const nuevas = aceptadas.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))
    setFotos((prev) => [...prev, ...nuevas])
    setErrorFotos(errores.length ? errores.join(' ') : undefined)
  }

  function quitarFoto(id: string) {
    setFotos((prev) => {
      const foto = prev.find((f) => f.id === id)
      if (foto) URL.revokeObjectURL(foto.url)
      return prev.filter((f) => f.id !== id)
    })
    setErrorFotos(undefined)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fotos.length === 0) {
      setErrorFotos('Agrega al menos una foto.')
      return
    }

    const ahora = new Date()
    setEnviando(true)
    setFormError(undefined)
    try {
      await onSubmit({
        nombre: `Lote ${formatoNombre.format(ahora)}`,
        parcela: parcela || null,
        fecha_cosecha: fechaCosecha || hoy,
        fotos: fotos.map((foto) => foto.file),
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No pudimos enviar el lote. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const resumen = [fotos.length && `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`, parcela].filter(Boolean).join(' · ')

  return (
    <form className="nuevo" onSubmit={handleSubmit} noValidate>
      <header className="nuevo__header">
        <button type="button" className="nuevo__back" onClick={onCancelar}>
          <Icon name="regresar" size={18} />
          Inicio
        </button>
        <h1 className="nuevo__title">Nuevo análisis</h1>
        <p className="nuevo__subtitle">Toma o sube fotos de tu lote. Identificamos la fruta y te damos su grado.</p>
      </header>

      <section className="card" aria-label="Fotos del lote">
        <FotosLote fotos={fotos} onAgregar={agregarFotos} onQuitar={quitarFoto} error={errorFotos} />
      </section>

      <section className="card nuevo__datos" aria-label="Datos del lote">
        <div className="field">
          <label className="field__label" htmlFor="parcela">
            Parcela
          </label>
          <div className="field__control field__control--select">
            <select id="parcela" className="field__input" value={parcela} onChange={(e) => setParcela(e.target.value)}>
              <option value="">Sin parcela</option>
              {parcelas.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TextField
          label="Fecha de cosecha"
          name="fecha_cosecha"
          type="date"
          max={hoy}
          value={fechaCosecha}
          onChange={(e) => setFechaCosecha(e.target.value)}
        />
        <p className="field__message nuevo__datos-nota">El nombre del lote se pone solo con la fecha y la hora.</p>
      </section>

      <div className="nuevo__bar">
        {formError && (
          <p className="nuevo__form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="nuevo__bar-row">
          <p className="nuevo__summary">{resumen || 'Agrega fotos para empezar'}</p>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Enviando…' : 'Analizar lote'}
          </Button>
        </div>
        <p className="nuevo__note">Preclasificación visual. No es una certificación de exportación.</p>
      </div>
    </form>
  )
}
