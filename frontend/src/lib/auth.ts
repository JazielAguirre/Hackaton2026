import { isAuthApiError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Error cuyo texto ya está listo para mostrarse en pantalla. */
export class MensajeParaUsuario extends Error {}

const CUENTA_EXISTE = 'Ya existe una cuenta con ese correo. Inicia sesión.'
const DEMASIADOS_INTENTOS = 'Demasiados intentos. Espera un momento y vuelve a intentar.'

// Códigos de error de Supabase Auth → mensaje corto en español.
const MENSAJES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: CUENTA_EXISTE,
  email_exists: CUENTA_EXISTE,
  weak_password: 'Esa contraseña es muy débil. Usa una más larga o con números.',
  email_address_invalid: 'Ese correo no es válido.',
  over_request_rate_limit: DEMASIADOS_INTENTOS,
  over_email_send_rate_limit: DEMASIADOS_INTENTOS,
  signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.',
}

function traducir(error: unknown): Error {
  // Solo se traducen las respuestas de Supabase. Un error de red se deja pasar
  // y la pantalla muestra "revisa tu internet".
  if (isAuthApiError(error)) {
    return new MensajeParaUsuario(MENSAJES[error.code ?? ''] ?? 'No pudimos completar el acceso. Intenta de nuevo.')
  }
  return error instanceof Error ? error : new Error(String(error))
}

export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
  if (error) throw traducir(error)
}

export async function crearCuenta(nombre: string, correo: string, contrasena: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    // El trigger crear_perfil_usuario() copia nombre_completo al perfil.
    options: { data: { nombre_completo: nombre }, emailRedirectTo: window.location.origin },
  })
  if (error) throw traducir(error)
  // Si el proyecto llegara a pedir confirmar el correo, la cuenta se crea sin sesión.
  if (!data.session) {
    throw new MensajeParaUsuario('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.')
  }
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw traducir(error)
}
