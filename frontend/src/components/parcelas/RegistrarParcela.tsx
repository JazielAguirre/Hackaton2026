import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Parcela } from '../../utils/dominio'
import { validarParcela } from '../../utils/parcelas'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { TextField } from '../ui/TextField'

export type NuevaParcela = Pick<Parcela, 'nombre' | 'latitud' | 'longitud'>

type RegistrarParcelaProps = {
  abierto: boolean
  existentes: readonly Pick<Parcela, 'nombre'>[]
  onCerrar: () => void
  /** Si lanza un Error, el mensaje se muestra en la hoja y no se cierra. */
  onGuardar: (parcela: NuevaParcela) => void | Promise<void>
}

const VACIO = { nombre: '', latitud: '', longitud: '' }

/**
 * Hoja para registrar una parcela (<dialog> nativo: atrapa el foco y cierra con Escape).
 * En celular sube desde abajo; en escritorio aparece al centro. Sale por el mismo camino.
 */
export function RegistrarParcela({ abierto, existentes, onCerrar, onGuardar }: RegistrarParcelaProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState<ReturnType<typeof validarParcela>>({})
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string>()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  function cambiar(campo: keyof typeof VACIO, valor: string) {
    const nuevos = { ...datos, [campo]: valor }
    setDatos(nuevos)
    // Después del primer intento, los errores se corrigen mientras se escribe
    if (intentado) setErrores(validarParcela(nuevos, existentes))
  }

  function cerrar() {
    setDatos(VACIO)
    setErrores({})
    setIntentado(false)
    setErrorGuardar(undefined)
    onCerrar()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const encontrados = validarParcela(datos, existentes)
    setIntentado(true)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return
    setGuardando(true)
    setErrorGuardar(undefined)
    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        latitud: datos.latitud.trim() ? Number(datos.latitud) : null,
        longitud: datos.longitud.trim() ? Number(datos.longitud) : null,
      })
      cerrar()
    } catch (error) {
      setErrorGuardar(error instanceof Error ? error.message : 'No pudimos guardar la parcela. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="hoja"
      aria-labelledby="registrar-parcela-titulo"
      onClose={cerrar}
      onClick={(event) => event.target === event.currentTarget && cerrar()}
    >
      <form className="hoja__contenido" onSubmit={handleSubmit} noValidate>
        <header className="hoja__header">
          <h2 id="registrar-parcela-titulo" className="hoja__titulo">
            Registrar parcela
          </h2>
          <button type="button" className="icon-button" onClick={cerrar} aria-label="Cerrar">
            <Icon name="cerrar" />
          </button>
        </header>

        <p className="hoja__texto">Cada lote que analizas pertenece a una parcela. Así ves la calidad de cada terreno.</p>

        <TextField
          label="Nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
          placeholder="Ej. El Mirador"
          maxLength={80}
          autoComplete="off"
          required
        />
        <div className="hoja__fila">
          <TextField
            label="Latitud"
            inputMode="decimal"
            value={datos.latitud}
            onChange={(e) => cambiar('latitud', e.target.value)}
            error={errores.latitud}
            placeholder="20.6597"
            hint="Opcional"
          />
          <TextField
            label="Longitud"
            inputMode="decimal"
            value={datos.longitud}
            onChange={(e) => cambiar('longitud', e.target.value)}
            error={errores.longitud}
            placeholder="-103.3496"
            hint="Opcional"
          />
        </div>

        {errorGuardar && (
          <p className="field__message field__message--error" role="alert">
            {errorGuardar}
          </p>
        )}

        <div className="hoja__acciones">
          <Button variant="secundario" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            Guardar parcela
          </Button>
        </div>
      </form>
    </dialog>
  )
}
