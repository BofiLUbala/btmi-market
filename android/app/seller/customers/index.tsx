import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, type Colors } from '../../../src/theme'

const emptyForm = { first_name: '', last_name: '', phone: '', email: '' }

export default function SellerCustomersScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const customers = useQuery({ queryKey: ['seller', 'customers', activeBusiness?.id], queryFn: () => sellerApi.customers(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => sellerApi.createCustomer(activeBusiness!.id, form),
    onMutate: () => setError(''),
    onSuccess: () => { setShowCreate(false); setForm(emptyForm); void queryClient.invalidateQueries({ queryKey: ['seller', 'customers'] }) },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.customers.createFailed')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (customers.isLoading) return <Loading label={t('seller.customers.loading')} />
  if (customers.isError) return <ErrorState message={t('seller.customers.loadFailed')} retry={() => void customers.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.customers')} action={<Button dense title={showCreate ? t('common.cancel') : t('seller.customers.add')} onPress={() => setShowCreate((v) => !v)} />} />
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {showCreate && <Card>
      <Text style={styles.cardTitle}>{t('seller.customers.addNew')}</Text>
      <Field label={t('auth.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} autoCapitalize="words" />
      <Field label={t('auth.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
      <Field label={t('auth.email')} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
      <Button title={t('seller.customers.create')} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}

    {!customers.data?.length ? <Card><Text style={styles.muted}>{t('seller.customers.noneYet')}</Text></Card> : customers.data.map((customer) => (
      <Pressable key={customer.id} accessibilityRole="button" onPress={() => router.push(`/seller/customers/${customer.id}`)}>
        <Card>
          <Text style={styles.name}>{customer.first_name} {customer.last_name}</Text>
          <Text style={styles.muted}>{customer.phone || '—'}{customer.email ? ` · ${customer.email}` : ''}</Text>
          <Text style={styles.muted}>{t('seller.customers.joined')}: {new Date(customer.created_at).toLocaleDateString()}</Text>
        </Card>
      </Pressable>
    ))}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  name: { fontSize: 17, fontWeight: '900', color: colors.ink },
})
