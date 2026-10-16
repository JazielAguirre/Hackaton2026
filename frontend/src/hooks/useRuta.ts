import { useMemo, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

/*
 * Enrutador mínimo con la History API (sin dependencias).
 * - La URL es la fuente de verdad: pantalla, filtros y vista se pueden compartir y recargar.
 * - Cada entrada del historial guarda su scroll para volver al mismo punto con "atrás".
 * - Al abrir el detalle de un lote o de una zona se usa View Transitions: entra por la derecha
 *   y sale por el mismo lado al regresar (ver ::view-transition en reportes.css).
 */

type Estado = { scrollY?: number; desdeLista?: boolean }

const oyentes = new Set<() => void>()
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Detalle de un lote o de una zona: entra por la derecha y sale por el mismo lado
const esDetalle = (ruta: string) => /^\/(reportes\/lote|zonas)\/[^/]+/.test(ruta)

function conTransicion(cambiar: () => void, rutaAnterior: string) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduceMotion) {
    cambiar()
    return
  }
  // Solo se desliza al entrar o salir del detalle; el menú y los filtros cambian sin transición
  const entra = esDetalle(location.pathname)
  if (entra === esDetalle(rutaAnterior)) {
    cambiar()
    return
  }
  document.documentElement.dataset.nav = entra ? 'adelante' : 'atras'
  const transicion = document.startViewTransition(() => flushSync(cambiar))
  transicion.finished.finally(() => delete document.documentElement.dataset.nav)
}

function avisar() {
  oyentes.forEach((oyente) => oyente())
}

let rutaActual = location.pathname

window.addEventListener('popstate', (event) => {
  const anterior = rutaActual
  rutaActual = location.pathname
  conTransicion(() => {
    avisar()
    window.scrollTo(0, (event.state as Estado | null)?.scrollY ?? 0)
  }, anterior)
})

type OpcionesNavegar = {
  /** Reemplaza la entrada actual (filtros, búsqueda) en vez de crear una nueva. */
  replace?: boolean
  /** Se guarda en la nueva entrada; p. ej. que el detalle se abrió desde la lista. */
  estado?: Estado
}

export function navegar(url: string, { replace = false, estado }: OpcionesNavegar = {}) {
  const anterior = location.pathname
  if (replace) {
    history.replaceState({ ...(history.state as Estado | null), ...estado }, '', url)
    rutaActual = location.pathname
    avisar()
    return
  }
  // Guarda el scroll de la pantalla que se deja, para restaurarlo al volver
  history.replaceState({ ...(history.state as Estado | null), scrollY: window.scrollY }, '')
  history.pushState({ ...estado }, '', url)
  rutaActual = location.pathname
  conTransicion(() => {
    avisar()
    window.scrollTo(0, 0)
  }, anterior)
}

/** Regresa con "atrás" del navegador si venimos de `ruta`; si no (enlace compartido), navega a ella. */
export function regresarA(ruta: string) {
  if ((history.state as Estado | null)?.desdeLista) history.back()
  else navegar(ruta)
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

const leer = () => location.pathname + location.search

/** Ruta actual (pathname + query). Se vuelve a pintar al navegar o al usar atrás/adelante. */
export function useRuta(): { path: string; params: URLSearchParams } {
  const url = useSyncExternalStore(suscribir, leer)
  const [path, search = ''] = url.split('?')
  const params = useMemo(() => new URLSearchParams(search), [search])
  return { path, params }
}
