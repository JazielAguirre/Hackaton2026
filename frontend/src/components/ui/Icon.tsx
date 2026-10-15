// Íconos de línea (24×24, trazo 2) dibujados a mano para no agregar dependencias
const PATHS = {
  fruta: (
    <>
      <path d="M12 21c-4.4 0-8-3.1-8-7.5C4 9.4 7 7 9.5 7c1.2 0 1.9.5 2.5.5s1.3-.5 2.5-.5C17 7 20 9.4 20 13.5 20 17.9 16.4 21 12 21Z" />
      <path d="M12 7.5c0-2 1-3.5 3-4.5" />
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
