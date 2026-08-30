import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../src/api'
import { ApiError } from '../src/api/client'
import { Button, ErrorState, Field, Loading } from '../src/components/ui'
import { useI18n } from '../src/store/i18n'
import { spacing } from '../src/theme'

export default function EditProfileScreen() {
  const qc = useQueryClient()
  const { t } = useI18n()
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile })

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', backup_phone: '', address: '', city: '', commune: '' })

  useEffect(() => {
    if (!profile.data) return
    setForm({
      first_name: profile.data.first_name ?? '',
      last_name: profile.data.last_name ?? '',
      phone: profile.data.phone ?? '',
      backup_phone: profile.data.backup_phone ?? '',
      address: profile.data.address ?? '',
      city: profile.data.city ?? '',
      commune: profile.data.commune ?? '',
    })
  }, [profile.data])

  const mutation = useMutation({
    mutationFn: () => buyerApi.updateProfile(form),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['buyer', 'profile'] })
      router.back()
    },
  })

  if (profile.isLoading) return <Loading label={t('profile.loading')} />

  const errorMessage = mutation.error instanceof ApiError ? mutation.error.message : t('editProfile.saveFailed')

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Field label={t('editProfile.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} />
      <Field label={t('editProfile.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
      <Field label={t('editProfile.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+243 …" />
      <Field label={t('editProfile.backupPhone')} value={form.backup_phone} onChangeText={(v) => setForm((f) => ({ ...f, backup_phone: v }))} keyboardType="phone-pad" placeholder={t('common.optional')} />
      <Field label={t('editProfile.address')} value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} placeholder={t('editProfile.addressPlaceholder')} />
      <Field label={t('editProfile.city')} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
      <Field label={t('editProfile.commune')} value={form.commune} onChangeText={(v) => setForm((f) => ({ ...f, commune: v }))} />

      {mutation.isError && <ErrorState message={errorMessage} />}

      <Button title={t('editProfile.save')} loading={mutation.isPending} disabled={!form.phone.trim()} onPress={() => mutation.mutate()} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
})
