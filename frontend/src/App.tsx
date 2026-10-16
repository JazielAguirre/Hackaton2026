import { useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { NAV_ITEMS, type NavId, type Vista } from './components/layout/navegacion'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { usePerfil } from './hooks/usePerfil'
import { useSesion } from './hooks/useSesion'
import { useTheme } from './hooks/useTheme'
import { cerrarSesion, crearCuenta, iniciarSesion } from './lib/auth'
import { HomePage } from './pages/HomePage'
import { LoginPage, type AuthData } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import type { LoteBitacora } from './utils/dominio'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const sesion = useSesion()
  const usuario = usePerfil(sesion)
  const [vista, setVista] = useState<Vista>('inicio')
  const [activo, setActivo] = useState<NavId>('inicio')

  // Al terminar bien, useSesion recibe la sesión nueva y se muestra la página principal.
  async function handleAuth(data: AuthData) {
    if (data.mode === 'login') await iniciarSesion(data.correo, data.contrasena)
    else await crearCuenta(data.nombre, data.correo, data.contrasena)
  }

  // TODO (backend): GET /lotes/{id}/reporte.pdf
  function handleDescargarReporte(lote: LoteBitacora) {
    console.info('Descargar reporte PDF del lote', lote.id)
  }

  function navegar(id: NavId) {
    setActivo(id)
    if (id === 'nuevo' || id === 'bitacora') {
      setVista(id)
      window.scrollTo({ top: 0 })
      return
    }
    // Reportes y alertas son secciones de inicio: se muestra inicio y se baja a la sección
    setVista('inicio')
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const destino = id === 'inicio' ? null : document.getElementById(id)
      if (destino) destino.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
      else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    })
  }

  async function salir() {
    setVista('inicio')
    setActivo('inicio')
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

  const item = NAV_ITEMS.find((navItem) => navItem.id === vista)

  return (
    <>
      <AppHeader
        usuario={usuario}
        activo={activo}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navegar}
        onLogout={salir}
      />
      <main className="app-main">
        {vista === 'inicio' || !item ? (
          <HomePage nombre={usuario.nombre} onNuevoAnalisis={() => navegar('nuevo')} onDescargarReporte={handleDescargarReporte} />
        ) : (
          <PlaceholderPage titulo={item.label} icon={item.icon} onVolver={() => navegar('inicio')} />
        )}
      </main>
    </>
  )
}
