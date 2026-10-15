import { LoginPage, type AuthData } from './pages/LoginPage'

export default function App() {
  // TODO: conectar con Supabase Auth (signInWithPassword / signUp) cuando exista src/lib/supabase.ts
  async function handleAuth(data: AuthData) {
    console.info('Formulario de acceso enviado:', data.mode, data.correo)
  }

  return <LoginPage onSubmit={handleAuth} />
}
