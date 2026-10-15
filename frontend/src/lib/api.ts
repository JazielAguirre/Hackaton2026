import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Yo = { id: string; email: string | null }

/** GET a la API de FruitScan con el token de la sesión. Si falla, lanza un Error con el mensaje de la API. */
export async function apiGet<T>(ruta: string): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Inicia sesión para continuar.')

  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('No pudimos conectar con la API de FruitScan.')
  }

  if (!respuesta.ok) {
    const cuerpo: { detail?: unknown } = await respuesta.json().catch(() => ({}))
    throw new Error(typeof cuerpo.detail === 'string' ? cuerpo.detail : `La API respondió con error ${respuesta.status}.`)
  }
  return (await respuesta.json()) as T
}
