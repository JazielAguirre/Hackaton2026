import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Yo = { id: string; email: string | null }

/** Error de la API con su código HTTP (p. ej. 404 para "lote no encontrado"). El mensaje ya viene en español. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

/** FastAPI manda `detail` como texto, o como lista de errores de validación (422). */
function mensajeDeError(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msg: unknown = (detail[0] as { msg?: unknown } | undefined)?.msg
    if (typeof msg === 'string') return msg.replace(/^Value error, /, '')
  }
  return `La API respondió con error ${status}.`
}

async function peticion(ruta: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'Inicia sesión para continuar.')

  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con la API de FruitScan.')
  }

  if (!respuesta.ok) {
    const cuerpo: { detail?: unknown } = await respuesta.json().catch(() => ({}))
    throw new ApiError(respuesta.status, mensajeDeError(cuerpo.detail, respuesta.status))
  }
  return respuesta
}

/** GET a la API de FruitScan con el token de la sesión. Si falla, lanza un ApiError con el mensaje de la API. */
export async function apiGet<T>(ruta: string): Promise<T> {
  return (await (await peticion(ruta)).json()) as T
}

/** POST con cuerpo JSON (o sin cuerpo). */
export async function apiPost<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const init: RequestInit =
    cuerpo === undefined
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }
  return (await (await peticion(ruta, init)).json()) as T
}

/** POST multipart (fotos). El navegador pone el Content-Type con su boundary. */
export async function apiPostForm<T>(ruta: string, formulario: FormData): Promise<T> {
  return (await (await peticion(ruta, { method: 'POST', body: formulario })).json()) as T
}

/** Descarga un archivo de la API (necesita el token, por eso no es un enlace directo). */
export async function apiDescargar(ruta: string, nombreArchivo: string): Promise<void> {
  const blob = await (await peticion(ruta)).blob()
  const url = URL.createObjectURL(blob)
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo })
  enlace.click()
  URL.revokeObjectURL(url)
}
