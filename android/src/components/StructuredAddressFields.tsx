import { Field } from './ui'

export interface StructuredAddressValue { province: string; city: string; commune: string; street: string; building_number: string; landmark: string }

export function StructuredAddressFields({ value, onChange }: { value: StructuredAddressValue; onChange: (value: StructuredAddressValue) => void }) {
  const set = (key: keyof StructuredAddressValue, next: string) => onChange({ ...value, [key]: next })
  return <>
    <Field label="Province" value={value.province} onChangeText={next => set('province', next)} />
    <Field label="Ville" value={value.city} onChangeText={next => set('city', next)} />
    <Field label="Commune" value={value.commune} onChangeText={next => set('commune', next)} />
    <Field label="Avenue / Rue / Adresse" value={value.street} onChangeText={next => set('street', next)} />
    <Field label="Numéro de maison / bâtiment" value={value.building_number} onChangeText={next => set('building_number', next)} />
    <Field label="Point de repère / Instructions" value={value.landmark} multiline onChangeText={next => set('landmark', next)} />
  </>
}
