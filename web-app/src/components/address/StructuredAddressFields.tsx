import { Field } from '@/components/ui/Field'
import { DRC_CITIES, KINSHASA_COMMUNES } from '@/lib/drcLocations'

export interface StructuredAddressValue { province: string; city: string; commune: string; street: string; building_number: string; landmark: string }

export function StructuredAddressFields({ value, onChange }: { value: StructuredAddressValue; onChange: (value: StructuredAddressValue) => void }) {
  const set = (key: keyof StructuredAddressValue, next: string) => onChange({ ...value, [key]: next })
  return <>
    <Field label="Province" name="province" required value={value.province} onChange={e => set('province', e.target.value)} />
    <Field as="select" label="Ville" name="city" required value={value.city} onChange={e => set('city', e.target.value)} options={[{value:'',label:'Sélectionner une ville'}, ...DRC_CITIES.map(city => ({value:city,label:city}))]} />
    <Field as={value.city === 'Kinshasa' ? 'select' : 'input'} label="Commune" name="commune" required value={value.commune} onChange={e => set('commune', e.target.value)} options={value.city === 'Kinshasa' ? [{value:'',label:'Sélectionner une commune'}, ...KINSHASA_COMMUNES.map(commune => ({value:commune,label:commune}))] : undefined} />
    <Field label="Avenue / Rue / Adresse" name="street" required value={value.street} onChange={e => set('street', e.target.value)} />
    <Field label="Numéro de maison / bâtiment" name="building_number" required value={value.building_number} onChange={e => set('building_number', e.target.value)} />
    <Field as="textarea" label="Point de repère / Instructions" name="landmark" value={value.landmark} onChange={e => set('landmark', e.target.value)} />
  </>
}
