import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  /** Elemento al final del campo, p. ej. el botón "Mostrar" de la contraseña. */
  trailing?: ReactNode
}

export function TextField({ label, error, hint, trailing, id, className, ...inputProps }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const message = error ?? hint

  return (
    <div className={className ? `field ${className}` : 'field'} data-invalid={error ? true : undefined}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={inputId}
          className="field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...inputProps}
        />
        {trailing}
      </div>
      {message && (
        <p id={messageId} className={error ? 'field__message field__message--error' : 'field__message'}>
          {message}
        </p>
      )}
    </div>
  )
}
