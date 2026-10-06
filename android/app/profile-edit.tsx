import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../src/api'
import { ApiError } from '../src/api/client'
import { Button, ErrorState, Field, Loading } from '../src/components/ui'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete } from '../src/components/StructuredAddressFields'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { radius, shadow, spacing, type Colors } from '../src/theme'
import Ionicons from '@expo/vector-icons/Ionicons'

const canonicalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0') ? `243${digits.slice(1)}` : digits
}

export default function EditProfileScreen() {
  const qc = useQueryClient()
  const { t } = useI18n()
  const colors = useColors()
  const styles = makeStyles(colors)
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile })

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    backup_phone: '',
    country: 'République Démocratique du Congo',
    latitude: null as number | null,
    longitude: null as number | null,
  })
  const [address, setAddress] = useState(emptyStructuredAddress())

  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!profile.data) return
    const p = profile.data
    setForm({
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      phone: p.phone ?? '',
      backup_phone: p.backup_phone ?? '',
      country: p.country ?? 'République Démocratique du Congo',
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
    })
    setAddress({
      province: p.province ?? '', city: p.city ?? '', commune: p.commune ?? '',
      province_id: p.province_id ?? '', city_id: p.city_id ?? '', commune_id: p.commune_id ?? '',
      street: p.street || p.address || '', building_number: p.building_number ?? '', landmark: p.landmark ?? '',
    })
  }, [profile.data])

  const mutation = useMutation({
    mutationFn: () => {
      setValidationError('')
      if (form.backup_phone.trim() && canonicalPhone(form.phone) === canonicalPhone(form.backup_phone)) {
        throw new Error(t('editProfile.backupPhoneMustDiffer'))
      }
      return buyerApi.updateProfile({
        ...form,
        province: address.province, province_id: address.province_id,
        city: address.city, city_id: address.city_id,
        commune: address.commune, commune_id: address.commune_id,
        street: address.street, building_number: address.building_number, landmark: address.landmark,
        address: [address.street, address.building_number, address.commune, address.city, address.province].filter(Boolean).join(', '),
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['buyer', 'profile'] })
      router.back()
    },
    onError: (e) => {
      if (e instanceof Error) setValidationError(e.message)
    },
  })

  if (profile.isLoading) return <Loading label={t('profile.loading')} />

  const errorMessage = validationError || (mutation.error instanceof ApiError ? mutation.error.message : mutation.error instanceof Error ? mutation.error.message : t('editProfile.saveFailed'))

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Field label={t('editProfile.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} />
        <Field label={t('editProfile.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
        <Field label={t('editProfile.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+243 …" />
        <Field label={t('editProfile.backupPhone')} value={form.backup_phone} onChangeText={(v) => setForm((f) => ({ ...f, backup_phone: v }))} keyboardType="phone-pad" placeholder={t('common.optional')} />
        <Field label={t('editProfile.country')} value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />
      </View>

      {/* Address card (reference "Mes adresses"): blue pin tile, title, warm hint box. */}
      <View style={[styles.card, isStructuredAddressComplete(address) && styles.cardSelected]}>
        <View style={styles.addressHead}>
          <View style={styles.pinTile}><Ionicons name="location" size={18} color={colors.onGreen} /></View>
          <Text style={styles.addressTitle}>{t('checkout.address')}</Text>
        </View>
        <View style={styles.hintBox}>
          <Text style={styles.addressHint}>{t('profileedit.addressHint')}</Text>
        </View>
        <StructuredAddressFields value={address} onChange={setAddress} />
        {!isStructuredAddressComplete(address) ? (
          <Text style={styles.addressIncomplete}>{t('profileedit.addressIncomplete')}</Text>
        ) : (
          <TouchableOpacity style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.completeText}>{t('profileedit.addressComplete')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {(mutation.isError || Boolean(validationError)) && <ErrorState message={errorMessage} />}

      <Button title={t('editProfile.save')} loading={mutation.isPending} disabled={!form.phone.trim()} onPress={() => mutation.mutate()} />
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 12, ...shadow.card },
  cardSelected: { borderColor: colors.green, borderWidth: 1.5 },
  addressHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinTile: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  addressTitle: { flex: 1, fontWeight: '700', fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  hintBox: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12 },
  addressHint: { color: colors.warning, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  addressIncomplete: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  completeText: { color: colors.success, fontWeight: '700', fontSize: 12 },
})
