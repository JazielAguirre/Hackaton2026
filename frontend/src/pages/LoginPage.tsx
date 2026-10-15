import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { TextField } from '../components/ui/TextField'
import '../styles/login.css'

export type AuthMode = 'login' | 'registro'

export type AuthData = {
  mode: AuthMode
  nombre: string
  correo: string
  contrasena: string
}

type Field = 'nombre' | 'correo' | 'contrasena'
type Values = Record<Field, string>

const MODES = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'registro', label: 'Crear cuenta' },
] as const

const MIN_CONTRASENA = 8
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(field: Field, values: Values, mode: AuthMode): string | undefined {
  switch (field) {
    case 'nombre':
      return mode === 'registro' && values.nombre.trim().length < 2 ? 'Escribe tu nombre.' : undefined
    case 'correo':
      return CORREO_REGEX.test(values.correo.trim()) ? undefined : 'Revisa tu correo, parece incompleto.'
    case 'contrasena':
      if (mode === 'login') return values.contrasena ? undefined : 'Escribe tu contraseña.'
      return values.contrasena.length >= MIN_CONTRASENA ? undefined : `Usa al menos ${MIN_CONTRASENA} caracteres.`
  }
}

type LoginPageProps = {
  onSubmit: (data: AuthData) => Promise<void>
}

export function LoginPage({ onSubmit }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [values, setValues] = useState<Values>({ nombre: '', correo: '', contrasena: '' })
  // Los errores se muestran solo después de que la persona sale del campo (o intenta enviar)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

  const fields: Field[] = mode === 'registro' ? ['nombre', 'correo', 'contrasena'] : ['correo', 'contrasena']
  const errorOf = (field: Field) => (touched[field] ? validate(field, values, mode) : undefined)

  function handleModeChange(next: AuthMode) {
    setMode(next)
    setTouched({})
    setFormError(undefined)
  }

  function update(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field: Field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(Object.fromEntries(fields.map((field) => [field, true])))
    if (fields.some((field) => validate(field, values, mode))) return

    setSubmitting(true)
    setFormError(undefined)
    try {
      await onSubmit({ mode, nombre: values.nombre.trim(), correo: values.correo.trim(), contrasena: values.contrasena })
    } catch {
      setFormError('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const isRegistro = mode === 'registro'

  return (
    <main className="auth">
      <section className="auth__card" aria-labelledby="auth-title">
        <header className="auth__header">
          <div className="auth__logo" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21c-4.4 0-8-3.1-8-7.5C4 9.4 7 7 9.5 7c1.2 0 1.9.5 2.5.5s1.3-.5 2.5-.5C17 7 20 9.4 20 13.5 20 17.9 16.4 21 12 21Z" />
              <path d="M12 7.5c0-2 1-3.5 3-4.5" />
            </svg>
          </div>
          <h1 id="auth-title" className="auth__title">
            FruitScan
          </h1>
          <p className="auth__subtitle">Revisa la calidad de tu lote desde el celular.</p>
        </header>

        <SegmentedControl label="Tipo de acceso" options={MODES} value={mode} onChange={handleModeChange} />

        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          {isRegistro && (
            <TextField
              className="auth__field-enter"
              label="Nombre"
              name="nombre"
              autoComplete="name"
              placeholder="Tu nombre"
              value={values.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              onBlur={() => markTouched('nombre')}
              error={errorOf('nombre')}
            />
          )}

          <TextField
            label="Correo"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nombre@correo.com"
            value={values.correo}
            onChange={(e) => update('correo', e.target.value)}
            onBlur={() => markTouched('correo')}
            error={errorOf('correo')}
          />

          <TextField
            label="Contraseña"
            name="contrasena"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isRegistro ? 'new-password' : 'current-password'}
            value={values.contrasena}
            onChange={(e) => update('contrasena', e.target.value)}
            onBlur={() => markTouched('contrasena')}
            error={errorOf('contrasena')}
            hint={isRegistro ? `Mínimo ${MIN_CONTRASENA} caracteres.` : undefined}
            trailing={
              <Button
                variant="plain"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </Button>
            }
          />

          {formError && (
            <p className="auth__form-error" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" className="auth__submit" loading={submitting}>
            {isRegistro ? 'Crear cuenta' : 'Entrar'}
          </Button>
        </form>

        <p className="auth__note">Preclasificación visual de fruta. No es una certificación de exportación.</p>
      </section>
    </main>
  )
}
