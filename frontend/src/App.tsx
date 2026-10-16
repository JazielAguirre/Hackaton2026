import { useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import type { NavId } from './components/layout/navegacion'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { usePerfil } from './hooks/usePerfil'
import { navegar, useRuta } from './hooks/useRuta'
import { useSesion } from './hooks/useSesion'
import { useTheme } from './hooks/useTheme'
import { apiDescargar } from './lib/api'
import { cerrarSesion, crearCuenta, iniciarSesion } from './lib/auth'
import { LoginPage, type AuthData } from './pages/LoginPage'
import {
  DetalleConectado,
  InicioConectado,
  NuevoConectado,
  ReportesConectado,
  ZonaDetalleConectado,
  ZonasConectado,
} from './pages/conectadas'
import type { LoteBitacora } from './utils/dominio'

const RUTA_DETALLE = /^\/reportes\/lote\/([^/]+)\/?$/
const RUTA_ZONA = /^\/zonas\/(\d+)\/?$/

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const sesion = useSesion()
  const usuario = usePerfil(sesion)
  const { path } = useRuta()
  const [errorPdf, setErrorPdf] = useState<string>()

  // Al terminar bien, useSesion recibe la sesión nueva y se muestra la página principal.
  async function handleAuth(data: AuthData) {
    if (data.mode === 'login') await iniciarSesion(data.correo, data.contrasena)
    else await crearCuenta(data.nombre, data.correo, data.contrasena)
  }

  async function handleDescargarReporte(lote: Pick<LoteBitacora, 'id'>) {
    setErrorPdf(undefined)
    try {
      await apiDescargar(`/lotes/${lote.id}/reporte.pdf`, `reporte-lote-${lote.id?.slice(0, 8)}.pdf`)
    } catch (error) {
      setErrorPdf(error instanceof Error ? error.message : 'No pudimos descargar el reporte.')
    }
  }

  function navegarMenu(id: NavId) {
    navegar(id === 'inicio' ? '/' : `/${id}`)
  }

  async function salir() {
    navegar('/')
    try {
      await cerrarSesion() // useSesion pasa a null y vuelve el login
    } catch (error) {
      console.warn('No se pudo cerrar la sesión:', error)
    }
  }

  // undefined = todavía se lee la sesión guardada: no se pinta nada para que el login no parpadee
  if (sesion === undefined) return null

  if (!sesion || !usuario) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={toggleTheme} floating />
        <LoginPage onSubmit={handleAuth} />
      </>
    )
  }

  // La URL decide la pantalla, así un enlace a un lote se puede compartir y recargar
  const detalle = RUTA_DETALLE.exec(path)
  const zonaRuta = RUTA_ZONA.exec(path)
  const activo: NavId = path === '/nuevo' ? 'nuevo' : path.startsWith('/reportes') ? 'reportes' : path.startsWith('/zonas') ? 'zonas' : 'inicio'

  let pagina
  if (detalle) {
    pagina = <DetalleConectado id={decodeURIComponent(detalle[1])} onDescargarPdf={handleDescargarReporte} />
  } else if (path === '/reportes' || path === '/reportes/') {
    pagina = <ReportesConectado onDescargarPdf={handleDescargarReporte} />
  } else if (zonaRuta) {
    pagina = <ZonaDetalleConectado id={Number(zonaRuta[1])} />
  } else if (path === '/zonas' || path === '/zonas/') {
    pagina = <ZonasConectado />
  } else if (path === '/nuevo') {
    pagina = <NuevoConectado />
  } else {
    pagina = <InicioConectado nombre={usuario.nombre} zona={usuario.zona} onDescargarPdf={handleDescargarReporte} />
  }

  return (
    <>
      <AppHeader
        usuario={usuario}
        activo={activo}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navegarMenu}
        onLogout={salir}
      />
      <main className="app-main">
        {errorPdf && (
          <p className="nuevo__form-error" role="alert">
            {errorPdf}
          </p>
        )}
        {pagina}
      </main>
    </>
  )
}
