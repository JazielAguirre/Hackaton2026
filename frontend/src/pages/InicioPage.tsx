import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { apiGet, type Yo } from '../lib/api'
import { cerrarSesion } from '../lib/auth'
import '../styles/login.css'

type EstadoApi = { tipo: 'cargando' } | { tipo: 'ok'; yo: Yo } | { tipo: 'error'; mensaje: string }

type InicioPageProps = {
  sesion: Session
}

/** Pantalla provisional después de entrar: confirma que la sesión también vale para la API. */
export function InicioPage({ sesion }: InicioPageProps) {
  const [api, setApi] = useState<EstadoApi>({ tipo: 'cargando' })
  const [saliendo, setSaliendo] = useState(false)
  const nombre: unknown = sesion.user.user_metadata?.nombre_completo

  useEffect(() => {
    let vigente = true
    apiGet<Yo>('/yo')
      .then((yo) => vigente && setApi({ tipo: 'ok', yo }))
      .catch((error: unknown) => {
        const mensaje = error instanceof Error ? error.message : 'Error desconocido.'
        if (vigente) setApi({ tipo: 'error', mensaje })
      })
    return () => {
      vigente = false
    }
  }, [sesion.access_token])

  async function salir() {
    setSaliendo(true)
    try {
      await cerrarSesion() // al salir, App vuelve a mostrar el login
    } catch {
      setSaliendo(false)
    }
  }

  return (
    <main className="auth">
      <section className="auth__card" aria-labelledby="inicio-title">
        <header className="auth__header">
          <h1 id="inicio-title" className="auth__title">
            {typeof nombre === 'string' && nombre ? `Hola, ${nombre}` : 'Hola'}
          </h1>
          <p className="auth__subtitle">Entraste como {sesion.user.email}</p>
        </header>

        {api.tipo === 'cargando' && <p className="auth__subtitle">Comprobando la conexión con la API…</p>}
        {api.tipo === 'ok' && (
          <p className="auth__subtitle" role="status">
            Conectado a la API de FruitScan como {api.yo.email}.
          </p>
        )}
        {api.tipo === 'error' && (
          <p className="auth__form-error" role="alert">
            {api.mensaje}
          </p>
        )}

        <Button className="auth__submit" loading={saliendo} onClick={salir}>
          Cerrar sesión
        </Button>

        <p className="auth__note">Preclasificación visual de fruta. No es una certificación de exportación.</p>
      </section>
    </main>
  )
}
