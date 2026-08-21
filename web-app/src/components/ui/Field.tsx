import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type Ref, useState } from 'react'

interface FieldProps {
  label?: string
  error?: string
  hint?: string
  as?: 'input' | 'textarea' | 'select'
  options?: Array<{ value: string; label: string }>
  showPasswordToggle?: boolean
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function renderField(
  { label, error, hint, className = '', id, as = 'input', options, children, showPasswordToggle, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement> & SelectHTMLAttributes<HTMLSelectElement>,
  ref: Ref<FieldElement>
) {
  const fieldId = id ?? rest.name
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = rest.type === 'password'
  const shouldShowToggle = showPasswordToggle && isPassword

  return (
    <div className="field">
      {label && <label htmlFor={fieldId}>{label}</label>}
      <div className="field-input-wrapper">
        {as === 'textarea' ? (
          <textarea ref={ref as Ref<HTMLTextAreaElement>} id={fieldId} className={`input ${className}`} {...rest} />
        ) : as === 'select' ? (
          <select ref={ref as Ref<HTMLSelectElement>} id={fieldId} className={`select ${className}`} {...rest}>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
        ) : (
          <input
            ref={ref as Ref<HTMLInputElement>}
            id={fieldId}
            className={`input ${className}`}
            type={shouldShowToggle && showPassword ? 'text' : rest.type}
            {...rest}
          />
        )}
        {shouldShowToggle && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        )}
      </div>
      {hint && !error && <span className="field-error">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export const Field = forwardRef<FieldElement, FieldProps & InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement> & SelectHTMLAttributes<HTMLSelectElement>>(renderField)