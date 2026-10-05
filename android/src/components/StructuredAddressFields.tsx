import { useEffect, useState, useMemo } from 'react'
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Field } from './ui'
import { useColors } from '../store/theme'
import { radius, type Colors } from '../theme'
import { useT } from '../store/i18n'
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
  const t = useT()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
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
        <View style={s.pickerBox}>
          {loading ? (
            <View style={{ flex: 1 }}><ActivityIndicator size="small" color={c.muted} style={{ alignSelf: 'flex-start' }} /></View>
          ) : (
            <Text style={[s.pickerValue, !value && s.placeholder]} numberOfLines={1}>
              {value || placeholder}
            </Text>
          )}
          <Ionicons name="chevron-down" size={18} color={c.muted} />
        </View>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { setOpen(false); setFilter('') }}>
                <Text style={s.sheetClose}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.search}
              placeholder={t('structuredAddressFields.searchPlaceholder')}
              placeholderTextColor={c.mutedLight}
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
              ListEmptyComponent={<Text style={s.empty}>{loading ? t('common.loading') : t('structuredAddressFields.noResults')}</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

/* ── Address form ────────────────────────────────────────────────────── */

export function StructuredAddressFields({ value, onChange }: { value: StructuredAddressValue; onChange: (v: StructuredAddressValue) => void }) {
  const t = useT()
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
      label={t('structuredAddressFields.province')} value={value.province}
      placeholder={t('structuredAddressFields.selectProvince')}
      items={provinces} onSelect={item => onChange({
        ...value, province_id: item.id, province: item.name,
        city_id: '', city: '', commune_id: '', commune: ''
      })}
    />
    <PickerField
      label={t('structuredAddressFields.city')} value={value.city}
      placeholder={!value.province_id ? t('structuredAddressFields.provinceFirst') : loadingCities ? t('common.loading') : t('structuredAddressFields.selectCity')}
      items={cities} loading={loadingCities}
      onSelect={item => onChange({
        ...value, city_id: item.id, city: item.name,
        commune_id: '', commune: ''
      })}
    />
    <PickerField
      label={t('structuredAddressFields.commune')} value={value.commune}
      placeholder={!value.city_id ? t('structuredAddressFields.cityFirst') : loadingCommunes ? t('common.loading') : t('structuredAddressFields.selectCommune')}
      items={communes} loading={loadingCommunes}
      onSelect={item => onChange({ ...value, commune_id: item.id, commune: item.name })}
    />
    <Field label={t('structuredAddressFields.street')} value={value.street} onChangeText={next => onChange({ ...value, street: next })} />
    <Field label={t('structuredAddressFields.buildingNumber')} value={value.building_number} onChangeText={next => onChange({ ...value, building_number: next })} />
    <Field label={t('structuredAddressFields.landmark')} value={value.landmark} onChangeText={next => onChange({ ...value, landmark: next })} />
  </>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  // Filled select field (reference "Créer mon compte"): label above, value + chevron.
  picker: { gap: 6, marginBottom: 12 },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: c.ink },
  pickerBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, paddingHorizontal: 14 },
  pickerValue: { flex: 1, fontSize: 15, color: c.ink },
  placeholder: { color: c.mutedLight },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: c.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '70%', paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: c.ink },
  sheetClose: { fontSize: 14, fontWeight: '600', color: c.green },
  search: { marginHorizontal: 16, marginTop: 12, marginBottom: 6, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.ink, backgroundColor: c.surface2 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  optionActive: { backgroundColor: c.greenSoft },
  optionText: { fontSize: 15, color: c.ink },
  optionTextActive: { color: c.green, fontWeight: '600' },
  empty: { textAlign: 'center', color: c.muted, padding: 20, fontSize: 14 },
})
