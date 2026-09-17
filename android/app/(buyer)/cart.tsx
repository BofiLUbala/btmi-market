import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { cartLineKey, useCart, type CartLine } from '../../src/store/cart'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { CartLineIssue, CartPreview } from '../../src/types'
import { formatMoney } from '../../src/lib/money'
import { idempotencyKey } from '../../src/lib/idempotency'

const money = (value: number, currency?: string) => formatMoney(value, currency)

interface ShopGroup { shopId: string; shopName: string; lines: CartLine[] }

/** Lines grouped by shop, in the order the buyer first added each shop. */
function groupByShop(lines: CartLine[]): ShopGroup[] {
  const groups: ShopGroup[] = []
  for (const line of lines) {
    let group = groups.find((g) => g.shopId === line.shopId)
    if (!group) {
      group = { shopId: line.shopId, shopName: line.shopName, lines: [] }
      groups.push(group)
    }
    group.lines.push(line)
  }
  return groups
}

export default function CartScreen() {
  const { lines, setQuantity, remove, clear } = useCart()
  const user = useAuth((state) => state.user)
  const { t } = useI18n()
  const colors = useColors()
  const themed = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: Boolean(user) && user?.account_type !== 'EMPLOYEE' })
  const [usePoints, setUsePoints] = useState(false)
  const [error, setError] = useState('')

  // Same rule as the web cart: browsing and the basket stay open to
  // everyone, but checkout is blocked until the buyer has a phone number on
  // file so sellers/delivery can actually reach them about the order.
  const profileIncomplete = Boolean(user && (!profile.data || !profile.data.phone?.trim()))

  // Every line carries its own shop; the backend groups them into one order per shop.
  const items = useMemo(() => lines.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    shop_id: line.shopId,
    quantity: line.quantity,
  })), [lines])
  const itemsKey = JSON.stringify(items)
  const groups = useMemo(() => groupByShop(lines), [lines])

  // Displayed only until the server answers; the backend owns the real price.
  const estimated = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  // The whole cart is priced in one call, across every shop, whenever it changes.
  const preview = useQuery<CartPreview>({
    queryKey: ['buyer', 'cartPreview', itemsKey, usePoints],
    queryFn: () => buyerApi.previewCart(items, usePoints),
    enabled: Boolean(user) && items.length > 0 && !profileIncomplete,
    retry: false,
    staleTime: 0,
  })

  useEffect(() => {
    // Points unavailable (no account, not enough points): fall back silently.
    if (preview.error && usePoints) setUsePoints(false)
  }, [preview.error, usePoints])

  const issues = useMemo(() => {
    const map = new Map<string, CartLineIssue>()
    for (const issue of preview.data?.issues ?? []) {
      map.set(cartLineKey({ productId: issue.product_id, variantId: issue.variant_id, shopId: issue.shop_id }), issue)
    }
    return map
  }, [preview.data])
  const blockedByIssues = Boolean(preview.data && !preview.data.checkoutable)

  const createMutation = useMutation({
    mutationFn: () => buyerApi.createCheckout(items, usePoints, idempotencyKey()),
    onSuccess: (data) => {
      const [firstOrderId] = data.order_ids
      if (!firstOrderId) {
        setError(t('cart.orderFailed'))
        return
      }
      // The cart is now real orders (one per shop). Keeping the lines would let
      // a back-navigation create the same orders a second time.
      clear()
      void queryClient.invalidateQueries({ queryKey: ['buyer', 'orders'] })
      router.replace({
        pathname: '/checkout/delivery',
        params: { orderId: firstOrderId, orderIds: data.order_ids.join(','), checkoutGroupId: data.checkout_group_id },
      })
    },
    onError: (err) => {
      void preview.refetch()
      setError(
        err instanceof ApiError && err.code === 'BUYER_PROFILE_INCOMPLETE'
          ? t('cart.profileIncomplete')
          : err instanceof ApiError && err.message ? err.message : t('cart.orderFailed')
      )
    },
  })

  function startCheckout() {
    if (!user) {
      router.push('/auth/login')
      return
    }
    if (profileIncomplete) {
      router.push('/profile-edit')
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

  const serverShop = (shopId: string) => preview.data?.shops.find((s) => s.shop_id === shopId)
  const currency = preview.data?.currency

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={t('cart.title', { count: lines.length })} />
      {groups.length > 1 ? <Text style={themed.muted}>{t('cart.multiShopNote', { count: groups.length })}</Text> : null}

      {groups.map((group) => {
        const shop = serverShop(group.shopId)
        return (
          <View key={group.shopId} style={styles.group}>
            <View style={styles.rowBetween}>
              <Text style={themed.shopLine}>{t('cart.orderFrom', { shop: shop?.shop_name || group.shopName })}</Text>
              {shop ? <Text style={themed.price}>{money(shop.subtotal, shop.currency)}</Text> : null}
            </View>
            {group.lines.map((line) => {
              const key = cartLineKey(line)
              const issue = issues.get(key)
              return (
                <Card key={key}>
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
                      <Text style={themed.unit}>{t('cart.perUnit', { amount: money(line.price, currency) })}</Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <Button variant="outline" title="−" style={styles.step} onPress={() => setQuantity(key, line.quantity - 1)} />
                    <Text style={themed.qty}>{line.quantity}</Text>
                    <Button variant="outline" title="+" style={styles.step} onPress={() => setQuantity(key, line.quantity + 1)} />
                    <Text style={themed.price}>{money(line.price * line.quantity, currency)}</Text>
                  </View>

                  {issue ? <Text style={themed.issue}>{issue.message || issue.code}</Text> : null}

                  <Button variant="outline" title={t('common.remove')} onPress={() => remove(key)} />
                </Card>
              )
            })}
          </View>
        )
      })}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={themed.name}>{t('cart.usePoints')}</Text>
          <Button
            variant={usePoints ? 'primary' : 'outline'}
            title={usePoints ? t('cart.pointsEnabled') : t('cart.pointsEnable')}
            onPress={() => setUsePoints(!usePoints)}
            disabled={!user}
          />
        </View>
        {usePoints && preview.data ? (
          <Text style={themed.pointsNote}>
            {t('cart.pointsDiscount', { amount: money(preview.data.points_discount_amount, currency) })}
          </Text>
        ) : (
          <Text style={themed.muted}>{t('cart.reduceCash')}</Text>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={themed.name}>{preview.data ? t('cart.verifiedTotal') : t('cart.estimatedSubtotal')}</Text>
          <Text style={themed.total}>{money(preview.data ? preview.data.final_total : estimated, currency)}</Text>
        </View>
        <Text style={themed.muted}>
          {preview.isFetching ? t('common.loading') : preview.data ? t('cart.priceConfirmed') : t('cart.priceNextStep')}
        </Text>
      </Card>

      {blockedByIssues ? <ErrorState message={t('cart.needsAttention')} /> : null}
      {preview.isError && !usePoints ? <ErrorState message={preview.error instanceof ApiError && preview.error.message ? preview.error.message : t('cart.verifyFailed')} retry={() => void preview.refetch()} /> : null}
      {error ? <ErrorState message={error} /> : null}

      {profileIncomplete && (
        <Card>
          <Text style={themed.name}>{t('cart.addPhoneTitle')}</Text>
          <Text style={themed.muted}>{t('cart.addPhoneBody')}</Text>
        </Card>
      )}

      <Button
        title={!user ? t('cart.signInToContinue') : profileIncomplete ? t('cart.completeProfile') : t('cart.placeOrder')}
        loading={createMutation.isPending}
        disabled={Boolean(user) && !profileIncomplete && (blockedByIssues || preview.isFetching)}
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
    shopLine: { color: c.green, fontWeight: '800', flex: 1 },
    name: { color: c.ink, fontWeight: '800', fontSize: 16 },
    unit: { color: c.muted, fontSize: 13 },
    qty: { minWidth: 28, textAlign: 'center', fontWeight: '900', color: c.ink, fontSize: 16 },
    price: { marginLeft: 'auto', color: c.green, fontWeight: '900' },
    total: { color: c.green, fontWeight: '900', fontSize: 19 },
    pointsNote: { color: c.success, fontWeight: '700' },
    issue: { color: c.danger, fontWeight: '700' },
    thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.greenSoft },
  })

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  group: { gap: spacing.sm },
  lineTop: { flexDirection: 'row', gap: spacing.sm },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  lineInfo: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  step: { minWidth: 52, paddingHorizontal: spacing.sm },
})
