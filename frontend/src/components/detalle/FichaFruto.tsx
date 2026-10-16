import { CLASES_SANAS, NOMBRE_DESTINO, NOMBRE_FRUTA, type FotoDetalle, type FrutoDetalle } from '../../utils/dominio'
import { Icon } from '../ui/Icon'

type FichaFrutoProps = {
  fruto: FrutoDetalle
  numero: number
  foto: FotoDetalle | undefined
  numeroFoto: number
  onCerrar?: () => void
}

const pct = (valor: number | null) => (valor === null ? '—' : `${Math.round(valor * 100)}%`)

/**
 * Recorte del fruto hecho con CSS sobre la foto original: se escala la foto para que
 * la caja ocupe todo el recuadro y se mueve hasta su posición (no se guarda otra imagen).
 */
function Recorte({ fruto, foto }: { fruto: FrutoDetalle; foto: FotoDetalle }) {
  const { caja_x: x, caja_y: y, caja_ancho: w, caja_alto: h } = fruto
  const posicion = (inicio: number, tamano: number) => (tamano >= 1 ? 0 : (inicio / (1 - tamano)) * 100)
  return (
    <span
      className="ficha-fruto__recorte"
      role="img"
      aria-label={`Recorte del fruto ${fruto.clase?.nombre ?? ''}`}
      style={{
        aspectRatio: `${w * (foto.ancho ?? 4)} / ${h * (foto.alto ?? 3)}`,
        backgroundImage: foto.url ? `url("${foto.url}")` : undefined,
        backgroundSize: `${100 / w}% ${100 / h}%`,
        backgroundPosition: `${posicion(x, w)}% ${posicion(y, h)}%`,
      }}
    />
  )
}

/** Resultado de un fruto: clase, destino y qué tan seguro estuvo el modelo. */
export function FichaFruto({ fruto, numero, foto, numeroFoto, onCerrar }: FichaFrutoProps) {
  const sano = fruto.clase ? CLASES_SANAS.has(fruto.clase.codigo) : false

  return (
    <div className="ficha-fruto">
      {foto && <Recorte fruto={fruto} foto={foto} />}
      <div className="ficha-fruto__info">
        <p className="ficha-fruto__titulo">
          Fruto {numero}
          <span className="ficha-fruto__meta">
            {' '}
            · {NOMBRE_FRUTA[fruto.fruta_id] ?? fruto.fruta_id} · foto {numeroFoto}
          </span>
        </p>
        <p className="ficha-fruto__clase">
          {fruto.requiere_revision
            ? `Sin clasificar (parece ${fruto.clase?.nombre.toLowerCase() ?? 'sin dato'})`
            : sano
              ? 'Sin defectos'
              : (fruto.clase?.nombre ?? 'Sin clasificar')}
        </p>
        <p className="ficha-fruto__destino">
          <span className="chip__punto" data-destino={fruto.destino} aria-hidden="true" />
          {NOMBRE_DESTINO[fruto.destino]}
        </p>
        <p className="ficha-fruto__conf">
          {fruto.requiere_revision
            ? `El modelo no estuvo seguro (${pct(fruto.conf_clasificacion)}). Revísalo a mano.`
            : `Confianza del modelo: ${pct(fruto.conf_clasificacion)}`}
        </p>
      </div>
      {onCerrar && (
        <button type="button" className="icon-button ficha-fruto__cerrar" onClick={onCerrar} aria-label="Cerrar resultado del fruto">
          <Icon name="cerrar" />
        </button>
      )}
    </div>
  )
}
