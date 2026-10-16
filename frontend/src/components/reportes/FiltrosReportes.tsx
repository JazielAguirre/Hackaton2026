import { useId, useState } from 'react'
import { GRADOS, NOMBRE_GRADO, type Grado } from '../../utils/dominio'
import { contarFiltros, nombreCultivo, type Filtros, type VistaLista } from '../../utils/reportes'
import { Icon, type IconName } from '../ui/Icon'
import { SegmentedControl } from '../ui/SegmentedControl'

type Opciones = {
  cultivos: string[]
  zonas: { id: string; nombre: string }[]
  grados: Grado[]
}

type FiltrosReportesProps = {
  filtros: Filtros
  opciones: Opciones
  vista: VistaLista
  total: number
  onChange: (filtros: Filtros) => void
  onLimpiar: () => void
  onVista: (vista: VistaLista) => void
}

const VISTAS = [
  { value: 'tabla', label: 'Tabla', icon: 'tabla' },
  { value: 'tarjetas', label: 'Tarjetas', icon: 'tarjetas' },
] as const

// Ícono de cada cultivo; uno que no esté aquí usa el genérico
const ICONO_FRUTA: Partial<Record<string, IconName>> = { mango: 'mango', jitomate: 'jitomate', fresa: 'fresa' }

function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

/** Barra fija con búsqueda, filtros y el cambio de vista. En celular, zona/fechas/grado van en un panel plegable. */
export function FiltrosReportes({ filtros, opciones, vista, total, onChange, onLimpiar, onVista }: FiltrosReportesProps) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const panelId = useId()
  const activos = contarFiltros(filtros)
  // Los que viven dentro del panel en celular (para el "Filtros (n)")
  const enPanel = (filtros.zona ? 1 : 0) + (filtros.desde ? 1 : 0) + (filtros.hasta ? 1 : 0) + filtros.grados.length
  const set = (cambio: Partial<Filtros>) => onChange({ ...filtros, ...cambio })

  return (
    <div className="filtros" role="search" aria-label="Filtrar reportes">
      <div className="filtros__fila">
        <label className="filtros__buscar">
          <Icon name="buscar" size={18} />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            className="filtros__buscar-input"
            placeholder="Buscar parcela o lote"
            value={filtros.q}
            onChange={(event) => set({ q: event.target.value })}
          />
        </label>

        <button
          type="button"
          className="chip filtros__toggle"
          aria-expanded={panelAbierto}
          aria-controls={panelId}
          onClick={() => setPanelAbierto((prev) => !prev)}
        >
          <Icon name="filtros" size={18} />
          Filtros{enPanel > 0 && ` (${enPanel})`}
        </button>

        <div className="filtros__vista">
          <SegmentedControl label="Ver como" options={VISTAS} value={vista} onChange={onVista} />
        </div>
      </div>

      {opciones.cultivos.length > 1 && (
        <div className="filtros__chips" role="group" aria-label="Cultivo">
          {opciones.cultivos.map((cultivo) => (
            <button
              key={cultivo}
              type="button"
              className="chip chip--fruta"
              data-fruta={cultivo}
              aria-pressed={filtros.cultivos.includes(cultivo)}
              onClick={() => set({ cultivos: alternar(filtros.cultivos, cultivo) })}
            >
              <span className="chip__icono" aria-hidden="true">
                <Icon name={ICONO_FRUTA[cultivo] ?? 'fruta'} size={16} />
              </span>
              {nombreCultivo(cultivo)}
            </button>
          ))}
        </div>
      )}

      <div id={panelId} className="filtros__panel" data-open={panelAbierto || undefined}>
        {opciones.zonas.length > 0 && (
          <label className="filtros__campo">
            <span className="filtros__etiqueta">Zona</span>
            <span className="field__control field__control--select">
              <select className="field__input" value={filtros.zona} onChange={(event) => set({ zona: event.target.value })}>
                <option value="">Todas las zonas</option>
                {opciones.zonas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </option>
                ))}
              </select>
            </span>
          </label>
        )}

        <label className="filtros__campo">
          <span className="filtros__etiqueta">Cosecha desde</span>
          <span className="field__control">
            <input
              type="date"
              className="field__input"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(event) => set({ desde: event.target.value })}
            />
          </span>
        </label>

        <label className="filtros__campo">
          <span className="filtros__etiqueta">Hasta</span>
          <span className="field__control">
            <input
              type="date"
              className="field__input"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(event) => set({ hasta: event.target.value })}
            />
          </span>
        </label>

        {opciones.grados.length > 0 && (
          <div className="filtros__campo">
            <span className="filtros__etiqueta" id={`${panelId}-grado`}>
              Grado
            </span>
            <div className="filtros__grados" role="group" aria-labelledby={`${panelId}-grado`}>
              {GRADOS.filter((g) => opciones.grados.includes(g)).map((grado) => (
                <button
                  key={grado}
                  type="button"
                  className="chip chip--grado"
                  data-grado={grado}
                  aria-pressed={filtros.grados.includes(grado)}
                  // Solo se ve la letra: el nombre completo queda para lectores de pantalla y al pasar el cursor
                  aria-label={NOMBRE_GRADO[grado]}
                  title={NOMBRE_GRADO[grado]}
                  onClick={() => set({ grados: alternar(filtros.grados, grado) })}
                >
                  {grado === 'rechazo' ? '✕' : grado}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="filtros__resumen">
        <p aria-live="polite">
          Mostrando {total} {total === 1 ? 'lote' : 'lotes'}
        </p>
        {activos > 0 && (
          <button type="button" className="button button--plain" onClick={onLimpiar}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
