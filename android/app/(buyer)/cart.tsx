import { useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { PointRedemptionPreview } from '../../src/types'

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FC`

/** RFC4122-ish v4 id. Used only as an idempotency key for order creation. */
function idempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function CartScreen() {
  const { lines, shopId, shopName, setQuantity, remove } = useCart()
  const user = useAuth((state) => state.user)
  const { t } = useI18n()
  const colors = useColors()
  const themed = useMemo(() => makeStyles(colors), [colors])
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: Boolean(user) && user?.account_type !== 'EMPLOYEE' })
  const [usePoints, setUsePoints] = useState(false)
  const [preview, setPreview] = useState<PointRedemptionPreview | null>(null)
  const [error, setError] = useState('')

  // Same rule as the web cart: browsing and the basket stay open to
  // everyone, but checkout is blocked until the buyer has a phone number on
  // file so sellers/delivery can actually reach them about the order.
  const profileIncomplete = Boolean(user && (!profile.data || !profile.data.phone?.trim()))

  const items = lines.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    quantity: line.quantity,
  }))

  // Displayed only until the server answers; the backend owns the real price.
  const estimated = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  const previewMutation = useMutation({
    mutationFn: (next: boolean) => buyerApi.previewOrder(shopId!, items, next),
    onSuccess: (data) => {
      setPreview(data)
      setError('')
    },
    onError: () => setError(t('cart.verifyFailed')),
  })

  const createMutation = useMutation({
    mutationFn: () => buyerApi.createOrder(shopId!, items, usePoints, idempotencyKey()),
    onSuccess: (data) => {
      // The cart is now a real order; keep the lines until the order is paid
      // so a failure mid-checkout does not lose the buyer's basket.
      router.push({ pathname: '/checkout/delivery', params: { orderId: data.order.id } })
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.code === 'BUYER_PROFILE_INCOMPLETE'
          ? t('cart.profileIncomplete')
          : t('cart.orderFailed')
      ),
  })

  function togglePoints() {
    const next = !usePoints
    setUsePoints(next)
    if (user) previewMutation.mutate(next)
  }

  function startCheckout() {
    if (!user) {
      router.push('/auth/login')
      return
    }
    if (profileIncomplete) {
      router.push('/profile-edit')
      return
    }
    if (!shopId) {
      Alert.alert(t('cart.invalidCart'), t('cart.invalidCartBody'))
      return
    }
    setError('')
    createMutation.mutate()
  }

  if (!lines.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="cart-outline" size={44} color={colors.muted} />
        <Text style={themed.emptyTitle}>{t('cart.empty')}</Text>
        <Text style={themed.muted}>{t('cart.emptyHint')}</Text>
        <Button title={t('cart.discover')} onPress={() => router.push('/(buyer)')} />
      </View>
    )
  }

  const busy = createMutation.isPending || previewMutation.isPending

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={t('cart.title', { count: lines.length })} />
      {shopName ? <Text style={themed.shopLine}>{t('cart.orderFrom', { shop: shopName })}</Text> : null}

      {lines.map((line) => (
        <Card key={line.variantId}>
          <View style={styles.lineTop}>
            {line.image ? (
              <Image source={line.image} style={themed.thumb} contentFit="cover" />
            ) : (
              <View style={[themed.thumb, styles.thumbEmpty]}>
                <Ionicons name="image-outline" size={20} color={colors.muted} />
              </View>
            )}
            <View style={styles.lineInfo}>
              <Text style={themed.name} numberOfLines={2}>{line.name}</Text>
              {line.variantName ? <Text style={themed.muted}>{line.variantName}</Text> : null}
              <Text style={themed.unit}>{t('cart.perUnit', { amount: money(line.price) })}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Button variant="outline" title="−" style={styles.step} onPress={() => setQuantity(line.variantId, line.quantity - 1)} />
            <Text style={themed.qty}>{line.quantity}</Text>
            <Button variant="outline" title="+" style={styles.step} onPress={() => setQuantity(line.variantId, line.quantity + 1)} />
            <Text style={themed.price}>{money(line.price * line.quantity)}</Text>
          </View>

          <Button variant="outline" title={t('common.remove')} onPress={() => remove(line.variantId)} />
        </Card>
      ))}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={themed.name}>{t('cart.usePoints')}</Text>
          <Button
            variant={usePoints ? 'primary' : 'outline'}
            title={usePoints ? t('cart.pointsEnabled') : t('cart.pointsEnable')}
            onPress={togglePoints}
          />
        </View>
        {usePoints && preview ? (
          <Text style={themed.pointsNote}>
            {t('cart.pointsApplied', { points: preview.points_used, amount: money(preview.points_discount_amount) })}
          </Text>
        ) : (
          <Text style={themed.muted}>{t('cart.reduceCash')}</Text>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={themed.name}>{preview ? t('cart.verifiedTotal') : t('cart.estimatedSubtotal')}</Text>
          <Text style={themed.total}>{money(preview ? preview.final_total : estimated)}</Text>
        </View>
        <Text style={themed.muted}>
          {preview ? t('cart.priceConfirmed') : t('cart.priceNextStep')}
        </Text>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {profileIncomplete && (
        <Card>
          <Text style={themed.name}>{t('cart.addPhoneTitle')}</Text>
          <Text style={themed.muted}>{t('cart.addPhoneBody')}</Text>
        </Card>
      )}

      <Button
        title={!user ? t('cart.signInToContinue') : profileIncomplete ? t('cart.completeProfile') : t('cart.placeOrder')}
        loading={busy}
        onPress={startCheckout}
      />
    </ScrollView>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static
 *  in `styles` so they are created once. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    emptyTitle: { color: c.ink, fontSize: 22, fontWeight: '900' },
    muted: { color: c.muted },
    shopLine: { color: c.green, fontWeight: '800' },
    name: { color: c.ink, fontWeight: '800', fontSize: 16 },
    unit: { color: c.muted, fontSize: 13 },
    qty: { minWidth: 28, textAlign: 'center', fontWeight: '900', color: c.ink, fontSize: 16 },
    price: { marginLeft: 'auto', color: c.green, fontWeight: '900' },
    total: { color: c.green, fontWeight: '900', fontSize: 19 },
    pointsNote: { color: c.success, fontWeight: '700' },
    thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.greenSoft },
  })

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  lineTop: { flexDirection: 'row', gap: spacing.sm },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  lineInfo: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  step: { minWidth: 52, paddingHorizontal: spacing.sm },
})
