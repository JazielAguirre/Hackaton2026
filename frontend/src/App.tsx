import { ThemeToggle } from './components/ui/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import { LoginPage, type AuthData } from './pages/LoginPage'

export default function App() {
  const { theme, toggleTheme } = useTheme()

  // TODO: conectar con Supabase Auth (signInWithPassword / signUp) cuando exista src/lib/supabase.ts
  async function handleAuth(data: AuthData) {
    console.info('Formulario de acceso enviado:', data.mode, data.correo)
  }

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <LoginPage onSubmit={handleAuth} />
    </>
  )
}
