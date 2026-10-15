export type FotoLocal = { id: string; file: File; url: string }

// Mismos límites que la API (api/app/services/imagenes.py y routers/fotos.py)
export const MAX_FOTOS = 20
const MAX_BYTES = 10 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

/** Separa las fotos válidas de las que la API rechazaría, con un mensaje corto por cada problema. */
export function validarFotos(nuevas: File[], actuales: number): { aceptadas: File[]; errores: string[] } {
  const aceptadas: File[] = []
  const errores: string[] = []
  for (const file of nuevas) {
    if (!TIPOS.includes(file.type)) errores.push(`«${file.name}» no es JPG, PNG ni WebP.`)
    else if (file.size > MAX_BYTES) errores.push(`«${file.name}» pesa más de 10 MB.`)
    else if (actuales + aceptadas.length >= MAX_FOTOS) {
      errores.push(`Solo caben ${MAX_FOTOS} fotos por lote.`)
      break
    } else aceptadas.push(file)
  }
  return { aceptadas, errores }
}
