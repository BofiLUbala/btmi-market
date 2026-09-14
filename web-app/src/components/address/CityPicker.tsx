import { useEffect, useState } from 'react'
import { Field } from '@/components/ui/Field'
import { locationsApi, type CityOption } from '@/api/locations'

/**
 * Single-city select fed by the same RDC hierarchy as the full address form.
 * Used where only a city matters (a shop's delivery zone), so no city list is
 * ever hardcoded in the client.
 */
export function CityPicker({ label, name, value, onChange, required, placeholder = 'Sélectionner une ville' }: {
  label: string
  name: string
  value: string
  onChange: (city: string) => void
  required?: boolean
  placeholder?: string
}) {
  const [cities, setCities] = useState<CityOption[]>([])

  useEffect(() => {
    let mounted = true
    locationsApi.allCities().then(items => { if (mounted) setCities(items) }, () => { if (mounted) setCities([]) })
    return () => { mounted = false }
  }, [])

  // Keep a stored value that is no longer in the list selectable rather than
  // silently blanking a shop's saved zone.
  const options = [{ value: '', label: placeholder }, ...cities.map(city => ({ value: city.name, label: city.name }))]
  if (value && !cities.some(city => city.name === value)) options.push({ value, label: value })

  return <Field as="select" label={label} name={name} required={required} value={value} options={options} onChange={e => onChange(e.target.value)} />
}
