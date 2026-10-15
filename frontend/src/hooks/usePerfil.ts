import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { Usuario } from '../components/layout/navegacion'
import { supabase } from '../lib/supabase'

const SIN_ZONA = 'Sin zona asignada'

/** Mientras llega el perfil se muestra lo que ya trae la sesión, para no dejar la pantalla en blanco. */
function usuarioProvisional(sesion: Session): Usuario {
  const nombre: unknown = sesion.user.user_metadata?.nombre_completo
  return {
    nombre: typeof nombre === 'string' && nombre ? nombre : (sesion.user.email?.split('@')[0] ?? 'Productor'),
    rol: 'productor',
    zona: SIN_ZONA,
  }
}

async function leerPerfil(sesion: Session): Promise<Usuario> {
  // RLS solo deja leer el perfil propio. El rol viene del perfil, nunca de la metadata del token.
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre_completo, rol, zonas(nombre)')
    .eq('id', sesion.user.id)
    .maybeSingle()
  if (error) throw error

  const provisional = usuarioProvisional(sesion)
  if (!data) return provisional
  return {
    nombre: data.nombre_completo ?? provisional.nombre,
    rol: data.rol,
    zona: data.zonas?.nombre ?? SIN_ZONA,
  }
}

/** Usuario para el encabezado y la página principal; null si no hay sesión. */
export function usePerfil(sesion: Session | null | undefined): Usuario | null {
  const [perfil, setPerfil] = useState<{ id: string; usuario: Usuario } | null>(null)

  useEffect(() => {
    if (!sesion) return
    let vigente = true
    leerPerfil(sesion)
      .then((usuario) => vigente && setPerfil({ id: sesion.user.id, usuario }))
      // Si falla, se queda el usuario provisional; la sesión sigue siendo válida.
      .catch((error: unknown) => console.warn('No se pudo leer el perfil:', error))
    return () => {
      vigente = false
    }
  }, [sesion])

  if (!sesion) return null
  return perfil?.id === sesion.user.id ? perfil.usuario : usuarioProvisional(sesion)
}
