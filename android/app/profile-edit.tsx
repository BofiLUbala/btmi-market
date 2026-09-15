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
import { spacing, type Colors } from '../src/theme'
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
    <ScrollView contentContainerStyle={styles.page}>
      <Field label={t('editProfile.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} />
      <Field label={t('editProfile.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
      <Field label={t('editProfile.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+243 …" />
      <Field label={t('editProfile.backupPhone')} value={form.backup_phone} onChangeText={(v) => setForm((f) => ({ ...f, backup_phone: v }))} keyboardType="phone-pad" placeholder={t('common.optional')} />
      <Field label={t('editProfile.country')} value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />

      <View style={styles.addressHead}>
        <Text style={styles.addressTitle}>Adresse de livraison</Text>
        <Text style={styles.addressHint}>C'est l'adresse utilisée pour vos livraisons.</Text>
      </View>
      <StructuredAddressFields value={address} onChange={setAddress} />
      {!isStructuredAddressComplete(address) ? (
        <Text style={styles.addressIncomplete}>Veuillez sélectionner la province, la ville et la commune, puis l'avenue et le numéro.</Text>
      ) : (
        <TouchableOpacity style={styles.completeBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.completeText}>Adresse complète</Text>
        </TouchableOpacity>
      )}

      {(mutation.isError || validationError) && <ErrorState message={errorMessage} />}

      <Button title={t('editProfile.save')} loading={mutation.isPending} disabled={!form.phone.trim()} onPress={() => mutation.mutate()} />
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
  addressHead: { marginTop: spacing.xs },
  addressTitle: { fontWeight: '800', fontSize: 15, color: colors.ink },
  addressHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addressIncomplete: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  completeText: { color: colors.success, fontWeight: '700', fontSize: 13 },
})