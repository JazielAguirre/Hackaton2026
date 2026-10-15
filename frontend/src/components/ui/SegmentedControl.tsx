import type { CSSProperties } from 'react'

type Option<T extends string> = { value: T; label: string }

type SegmentedControlProps<T extends string> = {
  label: string
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  // El "thumb" se desliza con transform según el índice activo (ver global.css)
  const style = {
    '--segment-count': options.length,
    '--segment-index': Math.max(0, options.findIndex((option) => option.value === value)),
  } as CSSProperties

  return (
    <div className="segmented" role="group" aria-label={label} style={style}>
      <span className="segmented__thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
