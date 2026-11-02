import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, ErrorState, Field, Loading } from '../../src/components/ui'
import { CourierTopBar } from '../../src/components/CourierOrderHeader'
import { PhoneInput } from '../../src/components/PhoneInput'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete } from '../../src/components/StructuredAddressFields'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/** Known transport types in the courier's words; anything else is shown as stored. */
const TRANSPORT_KEYS: Record<string, TranslationKey> = {
  MOTO: 'courierUi.transport.MOTO', MOTORCYCLE: 'courierUi.transport.MOTO',
  BICYCLE: 'courierUi.transport.BICYCLE', BIKE: 'courierUi.transport.BICYCLE',
  CAR: 'courierUi.transport.CAR', VAN: 'courierUi.transport.VAN', FOOT: 'courierUi.transport.FOOT',
}

/**
 * "My information" for a courier: the details the courier space really keeps
 * (phone, vehicle, zone, address), in the courier's own screen. The buyer's
 * profile page is not for them: it edits a shopping address and wears the
 * marketplace header.
 */
export default function CourierInfoScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile })

  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [zone, setZone] = useState('')
  const [address, setAddress] = useState(emptyStructuredAddress())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = profile.data
    if (!p) return
    setPhone(p.phone ?? '')
    setVehicle(p.vehicle_info ?? '')
    setZone(p.service_zone ?? '')
    setAddress({
      ...emptyStructuredAddress(),
      province: p.province ?? '', city: p.city ?? '', commune: p.commune ?? '',
      street: p.street ?? '', building_number: p.building_number ?? '', landmark: p.landmark ?? '',
    })
  }, [profile.data])

  const save = useMutation({
    mutationFn: () => courierApi.updateProfile({
      phone: phone.trim() || undefined,
      vehicle_info: vehicle.trim(),
      service_zone: zone.trim(),
      province: address.province, city: address.city, commune: address.commune,
      street: address.street, building_number: address.building_number, landmark: address.landmark,
    }),
    onSuccess: async () => {
      setSaved(true)
      await qc.invalidateQueries({ queryKey: ['courier', 'profile'] })
    },
  })

  const body = (() => {
    if (profile.isLoading) return <Loading label={t('common.loading')} />
    if (profile.isError || !profile.data) return <ErrorState message={t('courier.missionsFailed')} retry={() => void profile.refetch()} />
    const p = profile.data
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
    const transportKey = TRANSPORT_KEYS[(p.transport_type ?? '').toUpperCase()]
    const transportLabel = transportKey ? t(transportKey) : p.transport_type ?? ''
    const failed = save.error instanceof ApiError ? save.error.message : t('courierUi.info.failed')
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.readLabel}>{t('courierUi.info.name')}</Text>
          <Text style={styles.readValue}>{name || '—'}</Text>
          <Text style={styles.readLabel}>{t('courierUi.info.email')}</Text>
          <Text style={styles.readValue}>{p.email || '—'}</Text>
          <PhoneInput label={t('courierUi.info.phone')} value={phone} onChange={(v) => { setPhone(v); setSaved(false) }} testID="courier-phone" />
        </View>

        <View style={styles.card}>
          <Text style={styles.readLabel}>{t('courierUi.info.transport')}</Text>
          <Text style={styles.readValue}>{transportLabel || '—'}</Text>
          <Field label={t('courierUi.info.vehicle')} value={vehicle} onChangeText={(v) => { setVehicle(v); setSaved(false) }} />
          <Field label={t('courierUi.info.zone')} value={zone} onChangeText={(v) => { setZone(v); setSaved(false) }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('courierUi.info.address')}</Text>
          <StructuredAddressFields value={address} onChange={(a) => { setAddress(a); setSaved(false) }} />
          {!isStructuredAddressComplete(address) ? <Text style={styles.hint}>{t('profileedit.addressIncomplete')}</Text> : null}
        </View>

        {save.isError ? <ErrorState message={failed} /> : null}
        {saved ? <Text style={styles.savedText}>{t('courierUi.info.saved')}</Text> : null}
        <Button title={t('courierUi.info.save')} loading={save.isPending} onPress={() => save.mutate()} />
      </ScrollView>
    )
  })()

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <CourierTopBar title={t('courierUi.info.title')} />
      {body}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, gap: 12 },
  readLabel: { color: c.muted, fontSize: 12, fontWeight: '700' },
  readValue: { color: c.ink, fontSize: 15, fontWeight: '600', marginTop: -6 },
  sectionTitle: { color: c.ink, fontSize: 16, fontWeight: '700' },
  hint: { color: c.muted, fontSize: 12, fontStyle: 'italic' },
  savedText: { color: c.success, fontWeight: '700', fontSize: 13 },
})
