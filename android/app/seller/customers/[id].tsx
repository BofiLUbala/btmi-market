import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, type Colors } from '../../../src/theme'

export default function SellerCustomerDetailScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { id: customerId = '' } = useLocalSearchParams<{ id: string }>()

  const customer = useQuery({ queryKey: ['seller', 'customer', customerId], queryFn: () => sellerApi.customer(customerId), enabled: Boolean(customerId) })
  const orders = useQuery({ queryKey: ['seller', 'customerOrders', customerId], queryFn: () => sellerApi.customerOrders(customerId), enabled: Boolean(customerId) })

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!customer.data) return
    setForm({ first_name: customer.data.first_name, last_name: customer.data.last_name, phone: customer.data.phone ?? '', email: customer.data.email ?? '' })
  }, [customer.data?.id])

  const save = useMutation({
    mutationFn: () => sellerApi.updateCustomer(customerId, form),
    onMutate: () => setError(''),
    onSuccess: () => { setEditing(false); void queryClient.invalidateQueries({ queryKey: ['seller', 'customer', customerId] }); void queryClient.invalidateQueries({ queryKey: ['seller', 'customers'] }) },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.customers.updateFailed')),
  })

  if (customer.isLoading) return <Loading label={t('seller.customers.loading')} />
  if (customer.isError || !customer.data) return <ErrorState message={t('seller.customers.loadFailed')} retry={() => void customer.refetch()} />

  const c = customer.data

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={`${c.first_name} ${c.last_name}`} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Card>
      {!editing ? <>
        <Text style={styles.muted}>{c.phone || '—'}{c.email ? ` · ${c.email}` : ''}</Text>
        <Text style={styles.muted}>{t('common.status')}: {c.status}</Text>
        <Text style={styles.muted}>{t('seller.customers.joined')}: {new Date(c.created_at).toLocaleDateString()}</Text>
        <Button variant="outline" dense title={t('seller.customers.edit')} onPress={() => setEditing(true)} />
      </> : <>
        <Field label={t('auth.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} autoCapitalize="words" />
        <Field label={t('auth.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} autoCapitalize="words" />
        <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <Field label={t('auth.email')} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <Button title={t('common.saveChanges')} loading={save.isPending} onPress={() => save.mutate()} />
        <Button variant="outline" title={t('common.cancel')} onPress={() => setEditing(false)} />
      </>}
    </Card>

    <SectionTitle title={t('seller.customers.orderHistory')} />
    {orders.isLoading ? <Loading label={t('common.loading')} /> : orders.isError ? <ErrorState message={t('orders.loadFailed')} /> : !orders.data?.length ? <Card><Text style={styles.muted}>{t('seller.customers.noOrdersYet')}</Text></Card> : orders.data.map((order) => <Card key={order.id}>
      <View style={styles.row}>
        <Text style={styles.name}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text>
        <Text style={styles.muted}>{order.status}</Text>
      </View>
      <Text style={styles.muted}>{order.total_items} · {order.final_total.toLocaleString()} FC</Text>
      <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString()}</Text>
    </Card>)}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '900', color: colors.ink },
  date: { color: colors.muted, fontSize: 12 },
})
