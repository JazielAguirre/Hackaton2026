import { useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import type { NavId } from './components/layout/navegacion'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { usePerfil } from './hooks/usePerfil'
import { navegar, useRuta } from './hooks/useRuta'
import { useSesion } from './hooks/useSesion'
import { useTheme } from './hooks/useTheme'
import { cerrarSesion, crearCuenta, iniciarSesion } from './lib/auth'
import { DetalleLotePage } from './pages/DetalleLotePage'
import { HomePage } from './pages/HomePage'
import { LoginPage, type AuthData } from './pages/LoginPage'
import { NuevoAnalisisPage, type NuevoLote } from './pages/NuevoAnalisisPage'
import { ReportesPage } from './pages/ReportesPage'
import { detalleLoteEjemplo, lotesEjemplo, lotesReporteEjemplo } from './services/datosEjemplo'
import type { LoteBitacora } from './utils/dominio'

// TODO (backend): parcelas reales del productor (lotes.parcela sin repetir); por ahora salen de los datos de ejemplo
const PARCELAS = [...new Set(lotesEjemplo.map((lote) => lote.parcela).filter((p): p is string => Boolean(p)))]

const RUTA_DETALLE = /^\/reportes\/lote\/([^/]+)\/?$/

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const sesion = useSesion()
  const usuario = usePerfil(sesion)
  const { path } = useRuta()
  // Alertas es una sección de inicio: se recuerda para marcarla en el menú
  const [seccionInicio, setSeccionInicio] = useState<'inicio' | 'alertas'>('inicio')

  // Al terminar bien, useSesion recibe la sesión nueva y se muestra la página principal.
  async function handleAuth(data: AuthData) {
    if (data.mode === 'login') await iniciarSesion(data.correo, data.contrasena)
    else await crearCuenta(data.nombre, data.correo, data.contrasena)
  }

  // TODO (backend): GET /lotes/{id}/reporte.pdf
  function handleDescargarReporte(lote: Pick<LoteBitacora, 'id'>) {
    console.info('Descargar reporte PDF del lote', lote.id)
  }

  // TODO (backend): POST /lotes, POST /lotes/{id}/fotos y POST /lotes/{id}/analizar
  async function handleNuevoLote(lote: NuevoLote) {
    console.info('Nuevo lote listo para enviar:', lote.nombre, lote.parcela, lote.fotos.length, 'fotos')
    throw new Error('El envío a la API todavía no está conectado. Tus datos no se guardaron.')
  }

  function navegarMenu(id: NavId) {
    if (id === 'nuevo' || id === 'reportes') {
      navegar(`/${id}`)
      return
    }
    // Inicio y alertas viven en la página principal: se muestra y se baja a la sección
    setSeccionInicio(id)
    if (path !== '/') navegar('/')
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const destino = id === 'inicio' ? null : document.getElementById(id)
      if (destino) destino.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
      else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    })
  }

  async function salir() {
    navegar('/')
    setSeccionInicio('inicio')
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
  const activo: NavId = path === '/nuevo' ? 'nuevo' : path.startsWith('/reportes') ? 'reportes' : seccionInicio

  let pagina
  if (detalle) {
    // TODO (backend): GET /lotes/{id}
    const lote = detalleLoteEjemplo(decodeURIComponent(detalle[1]))
    pagina = <DetalleLotePage lote={lote} esEjemplo onDescargarPdf={handleDescargarReporte} />
  } else if (path === '/reportes' || path === '/reportes/') {
    // TODO (backend): vista bitacora_lotes + conteo de frutos por destino
    pagina = <ReportesPage lotes={lotesReporteEjemplo} esEjemplo onDescargarPdf={handleDescargarReporte} />
  } else if (path === '/nuevo') {
    pagina = <NuevoAnalisisPage parcelas={PARCELAS} onSubmit={handleNuevoLote} onCancelar={() => navegar('/')} />
  } else {
    pagina = (
      <HomePage
        nombre={usuario.nombre}
        onNuevoAnalisis={() => navegar('/nuevo')}
        onVerReportes={() => navegar('/reportes')}
        onDescargarReporte={handleDescargarReporte}
      />
    )
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
      <main className="app-main">{pagina}</main>
    </>
  )
}
