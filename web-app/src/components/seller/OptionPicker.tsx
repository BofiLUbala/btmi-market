import { colorSwatch } from '@/lib/colorSwatch'
import { toggleValue } from '@/lib/attributeOptions'

/**
 * Chip picker replacing free typing for attribute values (taille, couleur,
 * poids…). Single mode emits one string; multiple mode emits the list.
 */
export function OptionPicker({
  label,
  options,
  swatch = false,
  value,
  multiple = false,
  required = false,
  highlight = false,
  onChange,
  id,
}: {
  label: string
  options: string[]
  swatch?: boolean
  value: string | string[]
  multiple?: boolean
  required?: boolean
  highlight?: boolean
  onChange: (next: string | string[]) => void
  id?: string
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : []
  const isOn = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase())

  return (
    <div className={`option-picker${highlight ? ' option-picker--missing' : ''}`} id={id}>
      <div className="option-picker-label">
        <span>{label}{required ? ' *' : ''}</span>
        {selected.length > 0 && <span className="option-picker-value">{selected.join(', ')}</span>}
      </div>
      <div className="option-picker-chips" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map((option) => {
          const on = isOn(option)
          const dot = swatch ? colorSwatch(option) : null
          return (
            <button
              key={option}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              className={`option-chip${on ? ' is-on' : ''}`}
              onClick={() => {
                if (multiple) onChange(toggleValue(selected, option))
                else onChange(on ? '' : option)
              }}
            >
              {swatch && (
                <span
                  className={`option-chip-dot${dot ? '' : ' option-chip-dot--multi'}`}
                  style={dot ? { background: dot } : undefined}
                  aria-hidden="true"
                />
              )}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
