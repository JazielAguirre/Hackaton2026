import { useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { NAV_ITEMS, type NavId, type Usuario, type Vista } from './components/layout/navegacion'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import { HomePage } from './pages/HomePage'
import { LoginPage, type AuthData } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import type { LoteBitacora } from './utils/dominio'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [vista, setVista] = useState<Vista>('inicio')
  const [activo, setActivo] = useState<NavId>('inicio')

  // TODO (backend): conectar con Supabase Auth y leer el perfil real (nombre_completo, rol, zona)
  async function handleAuth(data: AuthData) {
    const nombre = data.mode === 'registro' ? data.nombre : data.correo.split('@')[0]
    setUsuario({ nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), rol: 'productor', zona: 'Zona Centro' })
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

  function cerrarSesion() {
    setUsuario(null)
    setVista('inicio')
    setActivo('inicio')
  }

  if (!usuario) {
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
        onLogout={cerrarSesion}
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
