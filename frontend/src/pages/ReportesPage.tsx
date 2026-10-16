import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FiltrosReportes } from '../components/reportes/FiltrosReportes'
import { MenuAcciones } from '../components/reportes/MenuAcciones'
import { TablaLotes } from '../components/reportes/TablaLotes'
import { TarjetasLotes } from '../components/reportes/TarjetasLotes'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { navegar, useRuta } from '../hooks/useRuta'
import type { LoteReporte } from '../utils/dominio'
import {
  agruparPorFecha,
  contarFiltros,
  descargarExcel,
  escribirFiltros,
  filtrarLotes,
  leerFiltros,
  opcionesFiltros,
  ordenarLotes,
  sinFiltros,
  type Columna,
  type Filtros,
  type VistaLista,
} from '../utils/reportes'
import '../styles/home.css'
import '../styles/reportes.css'

type ReportesPageProps = {
  lotes: LoteReporte[]
  /** Los datos aún no vienen de la BD (muestra la etiqueta "Datos de ejemplo"). */
  esEjemplo?: boolean
  onDescargarPdf: (lote: LoteReporte) => void
}

// Preferencia de vista de esta persona (la URL manda si trae ?vista=)
const CLAVE_VISTA = 'fruitscan-vista-reportes'
const ESCRITORIO = '(min-width: 48rem)'

function vistaGuardada(): VistaLista | null {
  try {
    const valor = localStorage.getItem(CLAVE_VISTA)
    return valor === 'tabla' || valor === 'tarjetas' ? valor : null
  } catch {
    return null
  }
}

/** Sin elección guardada: tarjetas en celular y tabla en escritorio (y cambia si se gira o se redimensiona). */
function useVistaPorDefecto(): VistaLista {
  const [escritorio, setEscritorio] = useState(() => window.matchMedia(ESCRITORIO).matches)
  useEffect(() => {
    const query = window.matchMedia(ESCRITORIO)
    const onChange = (event: MediaQueryListEvent) => setEscritorio(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return escritorio ? 'tabla' : 'tarjetas'
}

// Texto ordena de A a Z; números y fechas, de mayor a menor
const ORDEN_INICIAL_COLUMNA: Record<Columna, 'asc' | 'desc'> = {
  lote: 'asc',
  cultivo: 'asc',
  parcela: 'asc',
  grado: 'asc',
  cosecha: 'desc',
  frutos: 'desc',
  sanos: 'desc',
  separar: 'desc',
}

export function ReportesPage({ lotes, esEjemplo = false, onDescargarPdf }: ReportesPageProps) {
  const { params } = useRuta()
  const filtros = useMemo(() => leerFiltros(params), [params])
  const vistaUrl = params.get('vista')
  const vistaPorDefecto = useVistaPorDefecto()
  const vista: VistaLista = vistaUrl === 'tabla' || vistaUrl === 'tarjetas' ? vistaUrl : (vistaGuardada() ?? vistaPorDefecto)

  const opciones = useMemo(() => opcionesFiltros(lotes), [lotes])
  const filtrados = useMemo(() => filtrarLotes(lotes, filtros), [lotes, filtros])
  const grupos = useMemo(
    () => agruparPorFecha(ordenarLotes(filtrados, filtros.orden, filtros.dir)),
    [filtrados, filtros.orden, filtros.dir],
  )

  // Filtros y búsqueda reemplazan la entrada del historial: "atrás" no deshace cada letra
  function cambiarFiltros(nuevos: Filtros) {
    navegar(`/reportes${escribirFiltros(nuevos, vistaUrl === 'tabla' || vistaUrl === 'tarjetas' ? vistaUrl : null)}`, { replace: true })
  }

  function cambiarVista(nueva: VistaLista) {
    try {
      localStorage.setItem(CLAVE_VISTA, nueva)
    } catch {
      // sin almacenamiento: la vista se queda en la URL
    }
    navegar(`/reportes${escribirFiltros(filtros, nueva)}`, { replace: true })
  }

  function ordenar(columna: Columna) {
    const dir = columna === filtros.orden ? (filtros.dir === 'asc' ? 'desc' : 'asc') : ORDEN_INICIAL_COLUMNA[columna]
    cambiarFiltros({ ...filtros, orden: columna, dir })
  }

  const limpiar = () => cambiarFiltros(sinFiltros(filtros))

  // La altura de la barra fija se usa para pegar el encabezado de la tabla justo debajo
  const filtrosRef = useRef<HTMLDivElement>(null)
  const [altoFiltros, setAltoFiltros] = useState(0)
  useEffect(() => {
    const barra = filtrosRef.current
    if (!barra) return
    const observador = new ResizeObserver(([entrada]) => setAltoFiltros(entrada.borderBoxSize[0]?.blockSize ?? 0))
    observador.observe(barra)
    return () => observador.disconnect()
  }, [])

  return (
    <div className="reportes-page" style={{ '--filtros-alto': `${altoFiltros}px` } as CSSProperties}>
      <header className="reportes-page__header">
        <div>
          <h1 className="reportes-page__title">Reportes</h1>
          <p className="reportes-page__subtitle">
            La bitácora de tus lotes: grado, frutos sanos y reporte PDF.
            {esEjemplo && <span className="demo-pill">Datos de ejemplo</span>}
          </p>
        </div>
        <MenuAcciones
          className="reportes-page__exportar"
          etiqueta="Exportar"
          acciones={[
            { etiqueta: 'Excel', icono: 'tabla', onSelect: () => descargarExcel(filtrados, `reportes-fruitscan-${new Date().toISOString().slice(0, 10)}`) },
            // El navegador ofrece "Guardar como PDF"; los estilos de impresión dejan solo la lista
            { etiqueta: 'PDF', icono: 'reporte', onSelect: () => window.print() },
          ]}
        >
          <Icon name="descargar" size={18} />
          Exportar
        </MenuAcciones>
      </header>

      <div ref={filtrosRef} className="reportes-page__filtros">
        <FiltrosReportes
          filtros={filtros}
          opciones={opciones}
          vista={vista}
          total={filtrados.length}
          onChange={cambiarFiltros}
          onLimpiar={limpiar}
          onVista={cambiarVista}
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="reportes-page__vacio">
          <span className="placeholder__icon">
            <Icon name="buscar" size={28} />
          </span>
          {contarFiltros(filtros) > 0 ? (
            <>
              <p className="placeholder__title">No hay lotes con esos filtros</p>
              <Button variant="plain" onClick={limpiar}>
                Limpiar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="placeholder__title">Todavía no hay lotes</p>
              <p className="placeholder__text">Cuando analices tu primer lote, su reporte aparece aquí.</p>
            </>
          )}
        </div>
      ) : vista === 'tabla' ? (
        <TablaLotes grupos={grupos} orden={filtros.orden} dir={filtros.dir} onOrdenar={ordenar} onDescargarPdf={onDescargarPdf} />
      ) : (
        <TarjetasLotes grupos={grupos} onDescargarPdf={onDescargarPdf} />
      )}

      <p className="nota-legal">Preclasificación visual de fruta. No es una certificación de exportación.</p>
    </div>
  )
}
