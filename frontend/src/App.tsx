import { useMemo, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import type { NavId } from './components/layout/navegacion'
import type { NuevaZona } from './components/zonas/RegistrarZona'
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
import { ZonaDetallePage } from './pages/ZonaDetallePage'
import { ZonasPage } from './pages/ZonasPage'
import { alertasEjemplo, detalleLoteEjemplo, lotesEjemplo, lotesReporteEjemplo, zonasEjemplo } from './services/datosEjemplo'
import type { LoteBitacora, Zona } from './utils/dominio'
import { resumirZona } from './utils/zonas'

// TODO (backend): parcelas reales del productor (lotes.parcela sin repetir); por ahora salen de los datos de ejemplo
const PARCELAS = [...new Set(lotesEjemplo.map((lote) => lote.parcela).filter((p): p is string => Boolean(p)))]

const RUTA_DETALLE = /^\/reportes\/lote\/([^/]+)\/?$/
const RUTA_ZONA = /^\/zonas\/(\d+)\/?$/

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const sesion = useSesion()
  const usuario = usePerfil(sesion)
  const { path } = useRuta()
  // TODO (backend): leer y crear en la tabla zonas. Por ahora las nuevas viven solo en esta sesión.
  const [zonas, setZonas] = useState<Zona[]>(zonasEjemplo)
  const lotesConZona = useMemo(
    () => lotesReporteEjemplo.map((l) => ({ ...l, zona_nombre: zonas.find((z) => z.id === l.zona_id)?.nombre ?? l.zona_nombre })),
    [zonas],
  )

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
    navegar(id === 'inicio' ? '/' : `/${id}`)
  }

  // TODO (backend): insert en zonas (la BD asigna el id). Aquí se simula con el siguiente número.
  function registrarZona(nueva: NuevaZona) {
    setZonas((prev) => [...prev, { ...nueva, id: Math.max(0, ...prev.map((z) => z.id)) + 1, activa: true }])
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
    // TODO (backend): GET /lotes/{id}
    const lote = detalleLoteEjemplo(decodeURIComponent(detalle[1]))
    pagina = <DetalleLotePage lote={lote} esEjemplo onDescargarPdf={handleDescargarReporte} />
  } else if (path === '/reportes' || path === '/reportes/') {
    // TODO (backend): vista bitacora_lotes + conteo de frutos por destino
    pagina = <ReportesPage lotes={lotesConZona} esEjemplo onDescargarPdf={handleDescargarReporte} />
  } else if (zonaRuta) {
    const zona = zonas.find((z) => z.id === Number(zonaRuta[1]))
    pagina = <ZonaDetallePage resumen={zona ? resumirZona(zona, lotesConZona, alertasEjemplo) : null} esEjemplo />
  } else if (path === '/zonas' || path === '/zonas/') {
    // TODO (backend): tabla zonas, vista bitacora_lotes y función alertas_comunitarias
    pagina = <ZonasPage zonas={zonas} lotes={lotesConZona} alertas={alertasEjemplo} esEjemplo onRegistrar={registrarZona} />
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
