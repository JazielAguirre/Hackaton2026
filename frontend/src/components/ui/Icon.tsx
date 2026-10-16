// Íconos de línea (24×24, trazo 2) dibujados a mano para no agregar dependencias
const PATHS = {
  fruta: (
    <>
      <path d="M12 21c-4.4 0-8-3.1-8-7.5C4 9.4 7 7 9.5 7c1.2 0 1.9.5 2.5.5s1.3-.5 2.5-.5C17 7 20 9.4 20 13.5 20 17.9 16.4 21 12 21Z" />
      <path d="M12 7.5c0-2 1-3.5 3-4.5" />
    </>
  ),
  mango: (
    <>
      <path d="M6.5 19.5C3.5 16.5 4 10 8.5 7s10-2.5 11 1.5-1.5 9-6 11.5-5.5 1.5-7 .5Z" />
      <path d="M15.5 6.5c.2-2 1.6-3.3 3.5-3.5" />
    </>
  ),
  jitomate: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 6V3M8.5 6.5 12 8l3.5-1.5M12 8l-2 2.5M12 8l2 2.5" />
    </>
  ),
  fresa: (
    <>
      <path d="M12 21c-4-2-7.5-6-7.5-10 0-2.4 1.8-4 4-4h7c2.2 0 4 1.6 4 4 0 4-3.5 8-7.5 10Z" />
      <path d="M9 7l3-3 3 3M9.5 11h.01M14.5 11h.01M12 14h.01M10 16.5h.01M14 16.5h.01" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </>
  ),
  camara: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  bitacora: (
    <>
      <path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6Z" />
      <path d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2M9 8h6M9 12h6" />
    </>
  ),
  reporte: (
    <>
      <path d="M14 3H6v18h12V7Z" />
      <path d="M14 3v4h4M9 13h6M9 17h4" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  descargar: (
    <>
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  galeria: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  regresar: <path d="M15 5l-7 7 7 7" />,
  siguiente: <path d="M9 5l7 7-7 7" />,
  arriba: <path d="M6 15l6-6 6 6" />,
  abajo: <path d="M6 9l6 6 6-6" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  filtros: <path d="M4 6h16M7 12h10M10 18h4" />,
  opciones: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  ver: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  tabla: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 10v10" />
    </>
  ),
  tarjetas: (
    <>
      <rect x="3.5" y="4" width="7" height="7" rx="1.75" />
      <rect x="13.5" y="4" width="7" height="7" rx="1.75" />
      <rect x="3.5" y="13" width="7" height="7" rx="1.75" />
      <rect x="13.5" y="13" width="7" height="7" rx="1.75" />
    </>
  ),
  ampliar: <path d="M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6" />,
  acercar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5M8 11h6M11 8v6" />
    </>
  ),
  alejar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5M8 11h6" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

type IconProps = {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
