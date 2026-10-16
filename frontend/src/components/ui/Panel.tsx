import type { ReactNode } from 'react'

/** Grupo de paneles con un título corto; en escritorio, dos columnas (ver detalle-lote.css). */
export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="detalle-grupo" aria-label={titulo}>
      <h2 className="detalle-grupo__titulo">{titulo}</h2>
      <div className="detalle-grupo__paneles">{children}</div>
    </section>
  )
}

type PanelProps = { titulo: string; subtitulo?: string; className?: string; children: ReactNode }

export function Panel({ titulo, subtitulo, className, children }: PanelProps) {
  return (
    <article className={`card ${className ?? ''}`}>
      <header className="card__header">
        <h3 className="card__title">{titulo}</h3>
        {subtitulo && <p className="card__subtitle">{subtitulo}</p>}
      </header>
      {children}
    </article>
  )
}
