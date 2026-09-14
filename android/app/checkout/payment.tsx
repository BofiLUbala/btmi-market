import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

const money = (value: number, currency = 'FC') =>
  `${Math.round(value).toLocaleString('fr-FR')} ${currency}`

export default function PaymentScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { orderId } = useLocalSearchParams<{ orderId?: string }>()
  const clearCart = useCart((state) => state.clear)
  const { t } = useI18n()
  const [error, setError] = useState('')

  const quote = useQuery({
    queryKey: ['checkout', 'quote', orderId],
    queryFn: () => buyerApi.checkoutQuote(orderId!),
    enabled: Boolean(orderId),
  })
  const [paymentMethod, setPaymentMethod] = useState('')
  const methods = quote.data?.payment_methods ?? []
  const selectedMethod = methods.find((method) => method.code === paymentMethod) ?? methods[0]

  const order = useQuery({
    queryKey: ['checkout', 'order', orderId],
    queryFn: () => buyerApi.order(orderId!),
    enabled: Boolean(orderId),
  })

  const confirm = useMutation({
    mutationFn: () => buyerApi.createPayment(orderId!, selectedMethod.code),
    onSuccess: () => {
      // The basket has become a real order — only now is it safe to empty it.
      clearCart()
      router.replace({ pathname: '/orders/[id]', params: { id: orderId! } })
    },
    onError: () => setError(t('checkout.prepareFailed')),
  })

  if (!orderId) return <ErrorState message={t('checkout.orderNotFound')} retry={() => router.replace('/(buyer)/cart')} />
  if (quote.isLoading || order.isLoading) return <Loading label={t('checkout.preparingPayment')} />
  if (quote.isError || !quote.data || !selectedMethod) {
    return <ErrorState message={t('checkout.paymentFailed')} retry={() => quote.refetch()} />
  }

  const p = quote.data
  const lines = order.data?.lines ?? []

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.steps}>
        <Text style={styles.stepDone}>1 {t('tabs.cart')}</Text>
        <Text style={styles.stepDone}>2 {t('checkout.delivery')}</Text>
        <Text style={styles.stepActive}>3 {t('checkout.payment')}</Text>
      </View>

      <SectionTitle title={t('checkout.reviewOrder')} />

      <Card>
        <Text style={styles.blockTitle}>Mode de paiement</Text>
        {methods.map((method) => (
          <Button key={method.code} variant={(paymentMethod || selectedMethod.code) === method.code ? 'primary' : 'outline'} title={method.label} onPress={() => setPaymentMethod(method.code)} />
        ))}
      </Card>

      <Card>
        <Text style={styles.blockTitle}>{t('checkout.products')}</Text>
        {lines.map((line) => (
          <View key={line.id} style={styles.lineRow}>
            <View style={styles.lineInfo}>
              <Text style={styles.name} numberOfLines={2}>{line.product_name}</Text>
              <Text style={styles.muted}>
                {[line.variant_name, `${t('common.quantity')} ${line.quantity}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={styles.linePrice}>{money(line.final_unit_price * line.quantity)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.blockTitle}>{t('checkout.amountBreakdown')}</Text>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>{t('checkout.products')}</Text>
          <Text style={styles.value}>{money(p.subtotal, p.currency)}</Text>
        </View>
        {p.points_discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Réduction points</Text>
            <Text style={styles.discount}>−{money(p.points_discount, p.currency)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.muted}>{t('checkout.delivery')}</Text>
          <Text style={styles.value}>{money(p.delivery_fee, p.currency)}</Text>
        </View>
        <View style={styles.totalRow}><Text style={styles.muted}>Frais mode de paiement</Text><Text style={styles.value}>{money(selectedMethod.markup_amount, p.currency)}</Text></View>
      </Card>

      <Card>
        <Text style={styles.eyebrow}>TOTAL CALCULÉ PAR LE SERVEUR</Text>
        <Text style={styles.cashDue}>{money(selectedMethod.quoted_total, p.currency)}</Text>
        <View style={styles.cashNote}>
          <Ionicons name="cash-outline" size={18} color={colors.green} />
          <Text style={styles.muted}>
            {selectedMethod.timing === 'NOW' ? 'Le prestataire doit confirmer le paiement.' : 'Paiement exigible à la livraison.'}
          </Text>
        </View>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <Button
        variant="gold"
        title={t('checkout.confirmOrder')}
        loading={confirm.isPending}
        disabled={!selectedMethod}
        onPress={() => confirm.mutate()}
      />

    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stepDone: { color: colors.green, fontWeight: '800', fontSize: 12 },
  stepActive: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  blockTitle: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  lineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  lineInfo: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  linePrice: { color: colors.ink, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { color: colors.ink, fontWeight: '700' },
  discount: { color: colors.success, fontWeight: '800' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  cashDue: { color: colors.green, fontSize: 32, fontWeight: '900' },
  cashNote: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
})
