import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, Field, SectionTitle } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function SellerOnboardingScreen() {
  const user = useAuth((state) => state.user)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', category: '', phone: user?.phone || '', email: user?.email || '', city: '', country: 'CD' })
  const [error, setError] = useState('')
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const create = useMutation({
    mutationFn: () => sellerApi.createBusiness({ name: form.name.trim(), business_type: 'RETAIL', category: form.category.trim(), phone: form.phone.trim(), email: form.email.trim().toLowerCase(), country: form.country.trim(), city: form.city.trim(), default_currency: 'CDF' }),
    onMutate: () => setError(''),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['seller', 'businesses'] }); router.replace('/seller') },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : t('seller.onboardingFailed')),
  })
  const valid = Object.values(form).every((value) => value.trim())

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <SectionTitle title={t('seller.onboardingTitle')} />
    <Text style={styles.muted}>{t('seller.onboardingBody')}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Card>
      <Field label={t('seller.businessName')} value={form.name} onChangeText={(value) => set('name', value)} autoCapitalize="words" />
      <Field label={t('seller.businessCategory')} value={form.category} onChangeText={(value) => set('category', value)} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(value) => set('phone', value)} keyboardType="phone-pad" />
      <Field label={t('auth.email')} value={form.email} onChangeText={(value) => set('email', value)} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('seller.city')} value={form.city} onChangeText={(value) => set('city', value)} autoCapitalize="words" />
      <Field label={t('seller.country')} value={form.country} onChangeText={(value) => set('country', value)} autoCapitalize="characters" />
      <Button title={t('seller.createAndContinue')} loading={create.isPending} disabled={!valid} onPress={() => create.mutate()} />
    </Card>
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({ page:{padding:spacing.md,paddingBottom:spacing.xl,gap:spacing.md},muted:{color:colors.muted,lineHeight:21},error:{color:colors.danger,backgroundColor:colors.dangerSoft,padding:12,borderRadius:10} })
