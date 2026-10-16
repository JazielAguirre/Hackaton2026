import { useEffect, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import type { NuevaZona } from '../components/zonas/RegistrarZona'
import { useConsulta } from '../hooks/useConsulta'
import { navegar } from '../hooks/useRuta'
import { ApiError } from '../lib/api'
import { crearZona, enviarLote, leerAlertas, leerBitacora, leerLote, leerParcelas, leerZonas } from '../lib/datos'
import { rutaLote } from '../utils/reportes'
import { resumirZona } from '../utils/zonas'
import type { AlertaComunitaria, LoteBitacora, LoteReporte } from '../utils/dominio'
import { DetalleLotePage } from './DetalleLotePage'
import { HomePage } from './HomePage'
import { NuevoAnalisisPage, type NuevoLote } from './NuevoAnalisisPage'
import { ReportesPage } from './ReportesPage'
import { ZonaDetallePage } from './ZonaDetallePage'
import { ZonasPage } from './ZonasPage'

/*
 * Cada pantalla de Neyra recibe sus datos por props. Aquí se leen del backend al abrirla
 * (así siempre muestra lo último) y se pasan tal cual: no se recalcula grado ni destino.
 */

/** Mismo aspecto que las pantallas "No encontramos…", con el texto que toque. */
function Aviso({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="detalle detalle--vacio">
      <span className="placeholder__icon">
        <Icon name="buscar" size={28} />
      </span>
      <h1 className="placeholder__title">{titulo}</h1>
      {texto && <p className="placeholder__text">{texto}</p>}
      {children}
    </div>
  )
}

/** Espera la primera carga; si falla, ofrece reintentar. Cuando hay datos, pinta la pantalla. */
function Cargando<T>({
  consulta,
  children,
}: {
  consulta: { datos?: T; error?: Error; recargar: () => void }
  children: (datos: T) => ReactNode
}) {
  if (consulta.datos !== undefined) return <>{children(consulta.datos)}</>
  if (consulta.error) {
    return (
      <Aviso titulo="No pudimos cargar los datos" texto={consulta.error.message}>
        <Button onClick={consulta.recargar}>Reintentar</Button>
      </Aviso>
    )
  }
  return <Aviso titulo="Cargando…" />
}

type Descargar = (lote: Pick<LoteBitacora, 'id'>) => void

export function InicioConectado({
  nombre,
  zona,
  onDescargarPdf,
}: {
  nombre: string
  /** Nombre de la zona del usuario: las alertas de Inicio son las de su zona. */
  zona: string
  onDescargarPdf: Descargar
}) {
  const bitacora = useConsulta(leerBitacora)
  const alertas = useConsulta(leerAlertas)
  // Las alertas son un extra: si fallan, Inicio se muestra igual, sin ellas.
  const deMiZona = (alertas.datos ?? []).filter((a: AlertaComunitaria) => a.zona_nombre === zona)
  return (
    <Cargando consulta={bitacora}>
      {(lotes) => (
        <HomePage
          nombre={nombre}
          lotes={lotes}
          alertas={deMiZona}
          onNuevoAnalisis={() => navegar('/nuevo')}
          onVerReportes={() => navegar('/reportes')}
          onDescargarReporte={onDescargarPdf}
        />
      )}
    </Cargando>
  )
}

export function NuevoConectado() {
  const parcelas = useConsulta(leerParcelas)

  async function enviar(lote: NuevoLote) {
    // Las parcelas del select se identifican por nombre (único por usuario).
    const parcelaId = parcelas.datos?.find((p) => p.nombre === lote.parcela)?.id
    const id = await enviarLote(
      { nombre: lote.nombre, fecha_cosecha: lote.fecha_cosecha, ...(parcelaId && { parcela_id: parcelaId }) },
      lote.fotos,
    )
    navegar(rutaLote(id))
  }

  // Si las parcelas no cargan, se puede analizar igual, sin parcela.
  return <NuevoAnalisisPage parcelas={(parcelas.datos ?? []).map((p) => p.nombre)} onSubmit={enviar} onCancelar={() => navegar('/')} />
}

export function ReportesConectado({ onDescargarPdf }: { onDescargarPdf: (lote: LoteReporte) => void }) {
  const bitacora = useConsulta(leerBitacora)
  return <Cargando consulta={bitacora}>{(lotes) => <ReportesPage lotes={lotes} onDescargarPdf={onDescargarPdf} />}</Cargando>
}

const SEGUNDOS_ENTRE_CONSULTAS = 3

export function DetalleConectado({ id, onDescargarPdf }: { id: string; onDescargarPdf: Descargar }) {
  const lote = useConsulta(() => leerLote(id), id)
  const analizando = lote.datos?.estado === 'analizando'

  // Mientras el lote se analiza, se vuelve a consultar hasta que quede `analizado` o `error`.
  useEffect(() => {
    if (!analizando) return
    const temporizador = setInterval(lote.recargar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => clearInterval(temporizador)
  }, [analizando, lote.recargar])

  // Un lote que no existe (o es de otro usuario) usa la pantalla "No encontramos el lote".
  if (lote.error instanceof ApiError && lote.error.status === 404) return <DetalleLotePage lote={null} onDescargarPdf={onDescargarPdf} />
  return <Cargando consulta={lote}>{(datos) => <DetalleLotePage lote={datos} onDescargarPdf={onDescargarPdf} />}</Cargando>
}

export function ZonasConectado() {
  const zonas = useConsulta(leerZonas)
  const bitacora = useConsulta(leerBitacora)
  const alertas = useConsulta(leerAlertas)

  async function registrar(nueva: NuevaZona) {
    await crearZona(nueva) // un productor recibe aquí el 403 en español; la hoja lo muestra
    zonas.recargar()
  }

  return (
    <Cargando consulta={zonas}>
      {(listaZonas) => (
        <Cargando consulta={bitacora}>
          {(lotes) => <ZonasPage zonas={listaZonas} lotes={lotes} alertas={alertas.datos ?? []} onRegistrar={registrar} />}
        </Cargando>
      )}
    </Cargando>
  )
}

export function ZonaDetalleConectado({ id }: { id: number }) {
  const zonas = useConsulta(leerZonas)
  const bitacora = useConsulta(leerBitacora)
  const alertas = useConsulta(leerAlertas)
  return (
    <Cargando consulta={zonas}>
      {(listaZonas) => (
        <Cargando consulta={bitacora}>
          {(lotes) => {
            const zona = listaZonas.find((z) => z.id === id)
            return <ZonaDetallePage resumen={zona ? resumirZona(zona, lotes, alertas.datos ?? []) : null} />
          }}
        </Cargando>
      )}
    </Cargando>
  )
}
