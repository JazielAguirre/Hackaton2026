import { ThemeToggle } from './components/ui/ThemeToggle'
import { useSesion } from './hooks/useSesion'
import { useTheme } from './hooks/useTheme'
import { crearCuenta, iniciarSesion } from './lib/auth'
import { InicioPage } from './pages/InicioPage'
import { LoginPage, type AuthData } from './pages/LoginPage'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const sesion = useSesion()

  // Al terminar bien, useSesion recibe la sesión nueva y se cambia de pantalla solo.
  async function handleAuth(data: AuthData) {
    if (data.mode === 'login') await iniciarSesion(data.correo, data.contrasena)
    else await crearCuenta(data.nombre, data.correo, data.contrasena)
  }

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {/* undefined = todavía se lee la sesión guardada: no se pinta nada para que el login no parpadee */}
      {sesion === undefined ? null : sesion ? <InicioPage sesion={sesion} /> : <LoginPage onSubmit={handleAuth} />}
    </>
  )
}
