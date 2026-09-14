import { useEffect, useState } from 'react'
import { Field } from '@/components/ui/Field'
import { locationsApi, type CityOption, type CommuneOption, type ProvinceOption } from '@/api/locations'

export interface StructuredAddressValue {
  province: string
  city: string
  commune: string
  province_id: string
  city_id: string
  commune_id: string
  street: string
  building_number: string
  landmark: string
}

export const emptyStructuredAddress = (): StructuredAddressValue => ({
  province: '', city: '', commune: '', province_id: '', city_id: '', commune_id: '',
  street: '', building_number: '', landmark: ''
})

export const isStructuredAddressComplete = (value: StructuredAddressValue) =>
  Boolean(value.province_id && value.city_id && value.commune_id && value.street.trim() && value.building_number.trim())

/**
 * Province → Ville → Commune, all three read from the backend hierarchy.
 * Changing a level clears every level below it so a stale child id can never
 * be submitted with a new parent.
 */
export function StructuredAddressFields({ value, onChange }: { value: StructuredAddressValue; onChange: (value: StructuredAddressValue) => void }) {
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [communes, setCommunes] = useState<CommuneOption[]>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingCommunes, setLoadingCommunes] = useState(false)

  useEffect(() => {
    let mounted = true
    locationsApi.provinces().then(items => { if (mounted) setProvinces(items) }, () => { if (mounted) setProvinces([]) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!value.province_id) { setCities([]); return }
    let mounted = true
    setLoadingCities(true)
    locationsApi.cities(value.province_id).then(
      items => { if (mounted) { setCities(items); setLoadingCities(false) } },
      () => { if (mounted) { setCities([]); setLoadingCities(false) } }
    )
    return () => { mounted = false }
  }, [value.province_id])

  useEffect(() => {
    if (!value.city_id) { setCommunes([]); return }
    let mounted = true
    setLoadingCommunes(true)
    locationsApi.communes(value.city_id).then(
      items => { if (mounted) { setCommunes(items); setLoadingCommunes(false) } },
      () => { if (mounted) { setCommunes([]); setLoadingCommunes(false) } }
    )
    return () => { mounted = false }
  }, [value.city_id])

  const selectProvince = (id: string) => {
    const province = provinces.find(item => item.id === id)
    onChange({ ...value, province_id: id, province: province?.name ?? '', city_id: '', city: '', commune_id: '', commune: '' })
  }
  const selectCity = (id: string) => {
    const city = cities.find(item => item.id === id)
    onChange({ ...value, city_id: id, city: city?.name ?? '', commune_id: '', commune: '' })
  }
  const selectCommune = (id: string) => {
    const commune = communes.find(item => item.id === id)
    onChange({ ...value, commune_id: id, commune: commune?.name ?? '' })
  }

  return (
    <div className="structured-address">
      <Field
        as="select" label="Province" name="province_id" required
        value={value.province_id}
        onChange={e => selectProvince(e.target.value)}
        options={[{ value: '', label: 'Sélectionner une province' }, ...provinces.map(item => ({ value: item.id, label: item.name }))]}
      />
      <Field
        as="select" label="Ville" name="city_id" required
        value={value.city_id}
        disabled={!value.province_id || loadingCities}
        onChange={e => selectCity(e.target.value)}
        options={[{ value: '', label: value.province_id ? (loadingCities ? 'Chargement…' : 'Sélectionner une ville') : "Sélectionnez d'abord la province" }, ...cities.map(item => ({ value: item.id, label: item.name }))]}
      />
      <Field
        as="select" label="Commune" name="commune_id" required
        value={value.commune_id}
        disabled={!value.city_id || loadingCommunes}
        onChange={e => selectCommune(e.target.value)}
        options={[{ value: '', label: value.city_id ? (loadingCommunes ? 'Chargement…' : 'Sélectionner une commune') : "Sélectionnez d'abord la ville" }, ...communes.map(item => ({ value: item.id, label: item.name }))]}
      />
      <Field label="Avenue / Rue / Adresse" name="street" required value={value.street} onChange={e => onChange({ ...value, street: e.target.value })} />
      <Field label="Numéro de maison / bâtiment" name="building_number" required value={value.building_number} onChange={e => onChange({ ...value, building_number: e.target.value })} />
      <Field as="textarea" label="Instructions de livraison" name="landmark" value={value.landmark} onChange={e => onChange({ ...value, landmark: e.target.value })} />
    </div>
  )
}

/** Readable recap of what the buyer selected, shown once the address resolves. */
export function StructuredAddressSummary({ value }: { value: StructuredAddressValue }) {
  if (!isStructuredAddressComplete(value)) return null
  return (
    <dl className="address-summary">
      <div><dt>Province</dt><dd>{value.province}</dd></div>
      <div><dt>Ville</dt><dd>{value.city}</dd></div>
      <div><dt>Commune</dt><dd>{value.commune}</dd></div>
      <div><dt>Adresse</dt><dd>{value.street}</dd></div>
      <div><dt>Numéro</dt><dd>{value.building_number}</dd></div>
      {value.landmark.trim() && <div><dt>Instructions</dt><dd>{value.landmark}</dd></div>}
    </dl>
  )
}
