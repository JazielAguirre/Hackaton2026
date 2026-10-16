import { useEffect, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import type { NuevaParcela } from '../components/parcelas/RegistrarParcela'
import { useConsulta } from '../hooks/useConsulta'
import { navegar } from '../hooks/useRuta'
import { ApiError } from '../lib/api'
import { crearParcela, enviarLote, leerAlertas, leerBitacora, leerLote, leerParcelas, reintentarAnalisis } from '../lib/datos'
import { rutaLote } from '../utils/reportes'
import { resumirParcela } from '../utils/parcelas'
import { analisisDetenido, type AlertaComunitaria, type LoteBitacora, type LoteReporte } from '../utils/dominio'
import { DetalleLotePage } from './DetalleLotePage'
import { HomePage } from './HomePage'
import { NuevoAnalisisPage, type NuevoLote } from './NuevoAnalisisPage'
import { ParcelaDetallePage } from './ParcelaDetallePage'
import { ParcelasPage } from './ParcelasPage'
import { ReportesPage } from './ReportesPage'

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
    const id = await enviarLote({ nombre: lote.nombre, fecha_cosecha: lote.fecha_cosecha, parcela_id: lote.parcela_id }, lote.fotos)
    navegar(rutaLote(id))
  }

  // Sin las parcelas no se puede elegir una, así que se espera a que carguen.
  return (
    <Cargando consulta={parcelas}>
      {(lista) => (
        <NuevoAnalisisPage
          parcelas={lista.map((p) => ({ id: p.id, nombre: p.nombre }))}
          onSubmit={enviar}
          onCancelar={() => navegar('/')}
          onRegistrarParcela={() => navegar('/parcelas?nueva=1')}
        />
      )}
    </Cargando>
  )
}

export function ReportesConectado({ onDescargarPdf }: { onDescargarPdf: (lote: LoteReporte) => void }) {
  const bitacora = useConsulta(leerBitacora)
  return <Cargando consulta={bitacora}>{(lotes) => <ReportesPage lotes={lotes} onDescargarPdf={onDescargarPdf} />}</Cargando>
}

const SEGUNDOS_ENTRE_CONSULTAS = 3

export function DetalleConectado({ id, onDescargarPdf }: { id: string; onDescargarPdf: Descargar }) {
  const lote = useConsulta(() => leerLote(id), id)
  // Mientras el lote se analiza, se vuelve a consultar hasta que quede `analizado` o `error`.
  // Si lleva demasiado en `analizando` (la API se cayó) se deja de consultar y se ofrece reintentar.
  const analizando = lote.datos?.estado === 'analizando' && !analisisDetenido(lote.datos)
  useEffect(() => {
    if (!analizando) return
    const temporizador = setInterval(lote.recargar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => clearInterval(temporizador)
  }, [analizando, lote.recargar])

  async function reintentar() {
    await reintentarAnalisis(id)
    lote.recargar()
  }

  // Un lote que no existe (o es de otro usuario) usa la pantalla "No encontramos el lote".
  if (lote.error instanceof ApiError && lote.error.status === 404) return <DetalleLotePage lote={null} onDescargarPdf={onDescargarPdf} />
  return <Cargando consulta={lote}>{(datos) => <DetalleLotePage lote={datos} onDescargarPdf={onDescargarPdf} onReintentar={reintentar} />}</Cargando>
}

export function ParcelasConectado() {
  const parcelas = useConsulta(leerParcelas)
  const bitacora = useConsulta(leerBitacora)

  async function registrar(nueva: NuevaParcela) {
    await crearParcela(nueva) // un nombre repetido lanza su aviso en español; la hoja lo muestra
    parcelas.recargar()
  }

  return (
    <Cargando consulta={parcelas}>
      {(lista) => <Cargando consulta={bitacora}>{(lotes) => <ParcelasPage parcelas={lista} lotes={lotes} onRegistrar={registrar} />}</Cargando>}
    </Cargando>
  )
}

export function ParcelaDetalleConectado({ id, onDescargarPdf }: { id: string; onDescargarPdf: Descargar }) {
  const parcelas = useConsulta(leerParcelas)
  const bitacora = useConsulta(leerBitacora)
  return (
    <Cargando consulta={parcelas}>
      {(lista) => (
        <Cargando consulta={bitacora}>
          {(lotes) => {
            const parcela = lista.find((p) => p.id === id)
            return <ParcelaDetallePage resumen={parcela ? resumirParcela(parcela, lotes) : null} onDescargarPdf={onDescargarPdf} />
          }}
        </Cargando>
      )}
    </Cargando>
  )
}
