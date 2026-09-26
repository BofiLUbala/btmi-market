import type { ReactNode } from 'react'
import { attributeOptions, type AttributeLike } from '@/lib/attributeOptions'
import { OptionPicker } from './OptionPicker'

/**
 * One attribute value: chips when the attribute has a known option list for
 * this category, otherwise whatever free-form control the caller passes
 * (model numbers, dates… genuinely need typing).
 */
export function AttributeValueField({
  attribute,
  label,
  categorySlug,
  value,
  onChange,
  fallback,
  required,
  highlight,
  id,
}: {
  attribute: AttributeLike
  label: string
  categorySlug?: string | null
  value: string
  onChange: (next: string) => void
  fallback: ReactNode
  required?: boolean
  highlight?: boolean
  id?: string
}) {
  const options = attributeOptions(attribute, categorySlug, [value])
  if (!options) return <>{fallback}</>
  return (
    <OptionPicker
      id={id}
      label={label}
      required={required}
      highlight={highlight}
      options={options.values}
      swatch={options.swatch}
      value={value}
      onChange={(next) => onChange(next as string)}
    />
  )
}
