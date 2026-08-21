import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', block, size = 'md', loading, className = '', children, disabled, ...rest },
  ref
) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  )
})