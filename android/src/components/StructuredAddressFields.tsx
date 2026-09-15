import { useEffect, useState, useMemo } from 'react'
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { Field } from './ui'
import { locationsApi, type LocationProvince, type LocationCity, type LocationCommune } from '../api'

export interface StructuredAddressValue {
  province: string; city: string; commune: string
  province_id: string; city_id: string; commune_id: string
  street: string; building_number: string; landmark: string
}

export const emptyStructuredAddress = (): StructuredAddressValue => ({
  province: '', city: '', commune: '', province_id: '', city_id: '', commune_id: '',
  street: '', building_number: '', landmark: ''
})

export const isStructuredAddressComplete = (v: StructuredAddressValue) =>
  Boolean(v.province_id && v.city_id && v.commune_id && v.street.trim() && v.building_number.trim())

/* ── Lightweight modal picker ────────────────────────────────────────── */

interface PickerItem { id: string; name: string }

function PickerField({ label, value, placeholder, items, loading, onSelect }: {
  label: string; value: string; placeholder: string
  items: PickerItem[]; loading?: boolean
  onSelect: (item: PickerItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const filtered = useMemo(() => {
    if (!filter) return items
    const q = filter.toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(q))
  }, [items, filter])

  return (
    <>
      <TouchableOpacity style={s.picker} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={s.pickerLabel}>{label}</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#999" />
        ) : (
          <Text style={[s.pickerValue, !value && s.placeholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        )}
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { setOpen(false); setFilter('') }}>
                <Text style={s.sheetClose}>Fermer</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.search}
              placeholder="Rechercher…"
              value={filter}
              onChangeText={setFilter}
              autoFocus
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.option, item.name === value && s.optionActive]}
                  onPress={() => { onSelect(item); setOpen(false); setFilter('') }}
                >
                  <Text style={[s.optionText, item.name === value && s.optionTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.empty}>{loading ? 'Chargement…' : 'Aucun résultat'}</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

/* ── Address form ────────────────────────────────────────────────────── */

export function StructuredAddressFields({ value, onChange }: { value: StructuredAddressValue; onChange: (v: StructuredAddressValue) => void }) {
  const [provinces, setProvinces] = useState<LocationProvince[]>([])
  const [cities, setCities] = useState<LocationCity[]>([])
  const [communes, setCommunes] = useState<LocationCommune[]>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingCommunes, setLoadingCommunes] = useState(false)

  useEffect(() => {
    let active = true
    locationsApi.provinces().then(items => { if (active) setProvinces(items) }, () => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!value.province_id) { setCities([]); return }
    let active = true
    setLoadingCities(true)
    locationsApi.cities(value.province_id).then(
      items => { if (active) { setCities(items); setLoadingCities(false) } },
      () => { if (active) { setCities([]); setLoadingCities(false) } }
    )
    return () => { active = false }
  }, [value.province_id])

  useEffect(() => {
    if (!value.city_id) { setCommunes([]); return }
    let active = true
    setLoadingCommunes(true)
    locationsApi.communes(value.city_id).then(
      items => { if (active) { setCommunes(items); setLoadingCommunes(false) } },
      () => { if (active) { setCommunes([]); setLoadingCommunes(false) } }
    )
    return () => { active = false }
  }, [value.city_id])

  return <>
    <PickerField
      label="Province" value={value.province}
      placeholder="Sélectionner une province"
      items={provinces} onSelect={item => onChange({
        ...value, province_id: item.id, province: item.name,
        city_id: '', city: '', commune_id: '', commune: ''
      })}
    />
    <PickerField
      label="Ville" value={value.city}
      placeholder={!value.province_id ? "Sélectionnez d'abord la province" : loadingCities ? 'Chargement…' : 'Sélectionner une ville'}
      items={cities} loading={loadingCities}
      onSelect={item => onChange({
        ...value, city_id: item.id, city: item.name,
        commune_id: '', commune: ''
      })}
    />
    <PickerField
      label="Commune" value={value.commune}
      placeholder={!value.city_id ? "Sélectionnez d'abord la ville" : loadingCommunes ? 'Chargement…' : 'Sélectionner une commune'}
      items={communes} loading={loadingCommunes}
      onSelect={item => onChange({ ...value, commune_id: item.id, commune: item.name })}
    />
    <Field label="Avenue / Rue / Adresse" value={value.street} onChangeText={next => onChange({ ...value, street: next })} />
    <Field label="Numéro de la parcelle (ex : 12, 12A)" value={value.building_number} onChangeText={next => onChange({ ...value, building_number: next })} />
    <Field label="Point de repère (facultatif)" value={value.landmark} onChangeText={next => onChange({ ...value, landmark: next })} />
  </>
}

const s = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 13, paddingHorizontal: 12, marginBottom: 10, backgroundColor: '#fff' },
  pickerLabel: { fontSize: 13, color: '#666', marginBottom: 2 },
  pickerValue: { fontSize: 15, color: '#111', flexShrink: 1, textAlign: 'right' },
  placeholder: { color: '#999' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetClose: { fontSize: 15, color: '#2563EB' },
  search: { marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#f5f5f5' },
  option: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 15, color: '#222' },
  optionTextActive: { color: '#2563EB', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },
})