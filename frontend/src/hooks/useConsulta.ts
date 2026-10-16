import { useCallback, useEffect, useState } from 'react'

type Estado<T> = { datos?: T; error?: Error; cargando: boolean }

/**
 * Corre una consulta al montar la pantalla (y cuando cambia `clave`).
 * Mientras recarga conserva los datos anteriores, para que la pantalla no parpadee.
 */
export function useConsulta<T>(consulta: () => Promise<T>, clave: string = '') {
  const [estado, setEstado] = useState<Estado<T>>({ cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setEstado((previo) => ({ ...previo, error: undefined, cargando: true }))
    consulta().then(
      (datos) => vigente && setEstado({ datos, cargando: false }),
      (error: unknown) =>
        vigente && setEstado((previo) => ({ datos: previo.datos, error: error instanceof Error ? error : new Error(String(error)), cargando: false })),
    )
    return () => {
      vigente = false
    }
    // `consulta` es una función nueva en cada render: solo se vuelve a correr con `clave` o al reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, recargar }
}
