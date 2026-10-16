import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FotosLote } from '../components/analisis/FotosLote'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { TextField } from '../components/ui/TextField'
import { NOMBRE_FRUTA } from '../utils/dominio'
import { validarFotos, type FotoLocal } from '../utils/fotos'
import '../styles/nuevo-analisis.css'

/**
 * Lo que la página entrega para crear el lote (POST /lotes) y subir sus fotos (POST /lotes/{id}/fotos).
 * La fruta la elige el productor: el detector solo se entrenó con mango y la API usa la fruta del lote
 * para escoger el clasificador. El nombre del lote se genera solo.
 */
export type NuevoLote = {
  nombre: string
  fruta_principal: string
  parcela_id: string
  fecha_cosecha: string
  fotos: File[]
}

type NuevoAnalisisPageProps = {
  /** Parcelas activas del productor para el select. */
  parcelas: readonly { id: string; nombre: string }[]
  onSubmit: (lote: NuevoLote) => Promise<void>
  onCancelar: () => void
  /** Sin parcelas no se puede analizar: lleva a registrar una. */
  onRegistrarParcela: () => void
}

/** Fecha local en formato AAAA-MM-DD (no UTC, para que no cambie de día en la noche). */
function fechaLocal(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const formatoNombre = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export function NuevoAnalisisPage({ parcelas, onSubmit, onCancelar, onRegistrarParcela }: NuevoAnalisisPageProps) {
  const [fruta, setFruta] = useState('')
  const [errorFruta, setErrorFruta] = useState<string>()
  const [parcelaId, setParcelaId] = useState('')
  const [errorParcela, setErrorParcela] = useState<string>()
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
    // Cada lote tiene fruta y parcela; se revisa todo junto para mostrar todos los avisos a la vez
    if (!fruta) setErrorFruta('Elige la fruta del lote.')
    if (!parcelaId) setErrorParcela('Elige la parcela del lote.')
    if (fotos.length === 0) setErrorFotos('Agrega al menos una foto.')
    if (!fruta || !parcelaId || fotos.length === 0) return

    const ahora = new Date()
    setEnviando(true)
    setFormError(undefined)
    try {
      await onSubmit({
        nombre: `Lote ${formatoNombre.format(ahora)}`,
        fruta_principal: fruta,
        parcela_id: parcelaId,
        fecha_cosecha: fechaCosecha || hoy,
        fotos: fotos.map((foto) => foto.file),
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No pudimos enviar el lote. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const nombreParcela = parcelas.find((p) => p.id === parcelaId)?.nombre
  const resumen = [fotos.length && `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`, NOMBRE_FRUTA[fruta], nombreParcela]
    .filter(Boolean)
    .join(' · ')

  return (
    <form className="nuevo" onSubmit={handleSubmit} noValidate>
      <header className="nuevo__header">
        <button type="button" className="nuevo__back" onClick={onCancelar}>
          <Icon name="regresar" size={18} />
          Inicio
        </button>
        <h1 className="nuevo__title">Nuevo análisis</h1>
        <p className="nuevo__subtitle">Toma o sube fotos de tu lote y te damos su grado.</p>
      </header>

      <section className="card" aria-label="Fotos del lote">
        <FotosLote fotos={fotos} onAgregar={agregarFotos} onQuitar={quitarFoto} error={errorFotos} />
      </section>

      <section className="card nuevo__datos" aria-label="Datos del lote">
        <div className="field" data-invalid={errorFruta ? true : undefined}>
          <label className="field__label" htmlFor="fruta">
            Fruta
          </label>
          <div className="field__control field__control--select">
            <select
              id="fruta"
              className="field__input"
              value={fruta}
              aria-invalid={errorFruta ? true : undefined}
              aria-describedby={errorFruta ? 'fruta-error' : undefined}
              onChange={(e) => {
                setFruta(e.target.value)
                setErrorFruta(undefined)
              }}
            >
              <option value="">Elige la fruta</option>
              {Object.entries(NOMBRE_FRUTA).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          {errorFruta && (
            <p id="fruta-error" className="field__message field__message--error">
              {errorFruta}
            </p>
          )}
        </div>
        {parcelas.length === 0 ? (
          <div className="nuevo__sin-parcelas" role="alert">
            <p className="nuevo__sin-parcelas-texto">Para analizar un lote, primero registra una parcela.</p>
            <Button variant="secundario" onClick={onRegistrarParcela}>
              <Icon name="mas" size={18} />
              Registrar parcela
            </Button>
            {errorParcela && <p className="field__message field__message--error">{errorParcela}</p>}
          </div>
        ) : (
          <div className="field" data-invalid={errorParcela ? true : undefined}>
            <label className="field__label" htmlFor="parcela">
              Parcela
            </label>
            <div className="field__control field__control--select">
              <select
                id="parcela"
                className="field__input"
                value={parcelaId}
                aria-invalid={errorParcela ? true : undefined}
                aria-describedby={errorParcela ? 'parcela-error' : undefined}
                onChange={(e) => {
                  setParcelaId(e.target.value)
                  setErrorParcela(undefined)
                }}
              >
                <option value="">Elige una parcela</option>
                {parcelas.map((parcela) => (
                  <option key={parcela.id} value={parcela.id}>
                    {parcela.nombre}
                  </option>
                ))}
              </select>
            </div>
            {errorParcela && (
              <p id="parcela-error" className="field__message field__message--error">
                {errorParcela}
              </p>
            )}
          </div>
        )}
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
