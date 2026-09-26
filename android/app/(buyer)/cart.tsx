import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { cartLineKey, useCart, type CartLine } from '../../src/store/cart'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors, fonts } from '../../src/theme'
import type { CartLineIssue, CartPreview } from '../../src/types'
import { formatMoney } from '../../src/lib/money'
import { idempotencyKey } from '../../src/lib/idempotency'
import { CheckoutProgress } from '../../src/components/CheckoutProgress'
import type { TranslationKey } from '../../src/locales/fr'

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
  /** Web wording (copied under `web.*`). */
  const w = (key: string, vars?: Record<string, string | number>) => t(`web.${key}` as TranslationKey, vars)
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
        <View style={themed.emptyMark}><Text style={themed.emptyMarkText}>TBK</Text></View>
        <Text style={themed.emptyTitle}>{w('cart.empty.title')}</Text>
        <Text style={themed.emptyText}>{w('cart.empty.description')}</Text>
        <Button title={w('cart.empty.browse')} onPress={() => router.push('/(buyer)/search')} />
      </View>
    )
  }

  const serverShop = (shopId: string) => preview.data?.shops.find((s) => s.shop_id === shopId)
  const currency = preview.data?.currency

  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0)
  const itemsLabel = (n: number) => `${n} ${n === 1 ? w('cart.item') : w('cart.items')}`

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <CheckoutProgress current="cart" />

      {/* web .checkout-heading */}
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={themed.h1}>{w('cart.title')}</Text>
          <Text style={themed.headingSub}>
            {groups.length > 1 ? t('cart.multiShopNote', { count: groups.length }) : w('cart.orderFrom', { shop: groups[0]?.shopName ?? '' })}
          </Text>
        </View>
        <Text style={themed.countPill}>{itemsLabel(totalQty)}</Text>
      </View>

      {error ? <View style={themed.inlineError}><Text style={themed.inlineErrorTitle}>{w('cart.needsAttention')}</Text><Text style={themed.inlineErrorText}>{error}</Text></View> : null}

      {groups.map((group) => {
        const shop = serverShop(group.shopId)
        const groupQty = group.lines.reduce((sum, line) => sum + line.quantity, 0)
        const groupSubtotal = shop?.subtotal ?? group.lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
        return (
          <View key={group.shopId} style={themed.card}>
            <View style={themed.cardHead}>
              <Text style={themed.cardTitle} numberOfLines={1}>{shop?.shop_name || group.shopName}</Text>
              <Text style={themed.cardHeadMeta}>{itemsLabel(groupQty)} · {money(groupSubtotal, currency)}</Text>
            </View>
            {group.lines.map((line, index) => {
              const key = cartLineKey(line)
              const issue = issues.get(key)
              return (
                <View key={key} style={[themed.row, index === group.lines.length - 1 && themed.rowLast]}>
                  <View style={styles.rowTop}>
                    <View style={themed.thumb}>
                      {line.image ? <Image source={line.image} style={styles.thumbImg} contentFit="contain" /> : <Ionicons name="image-outline" size={22} color={colors.muted} />}
                    </View>
                    <View style={styles.info}>
                      <Text style={themed.name} numberOfLines={2}>{line.name}</Text>
                      {line.variantName ? <Text style={themed.muted}>{line.variantName}</Text> : null}
                      <Text style={themed.small}>{w('product.soldBy')} {line.shopName}</Text>
                      <Text style={themed.unitPrice}>{money(line.price, currency)}</Text>
                      {issue ? <Text style={themed.issue}>{issue.message || issue.code}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={styles.controls}>
                      <Text style={themed.tiny}>{w('common.quantity')}</Text>
                      <View style={themed.stepper}>
                        <Pressable accessibilityRole="button" accessibilityLabel="−" disabled={line.quantity <= 1} style={[styles.stepBtn, line.quantity <= 1 && styles.disabled]} onPress={() => setQuantity(key, line.quantity - 1)}>
                          <Text style={themed.stepText}>−</Text>
                        </Pressable>
                        <Text style={themed.qty}>{line.quantity}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="+" style={styles.stepBtn} onPress={() => setQuantity(key, line.quantity + 1)}>
                          <Text style={themed.stepText}>+</Text>
                        </Pressable>
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => remove(key)} hitSlop={8}>
                        <Text style={themed.remove}>{w('common.remove')}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.lineTotal}>
                      <Text style={themed.tiny}>{w('common.subtotal')}</Text>
                      <Text style={themed.lineTotalValue}>{money(line.price * line.quantity, currency)}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )
      })}

      {/* web .rewards-card */}
      {user ? (
        <View style={[themed.rewards, usePoints && themed.rewardsOn]}>
          <View style={styles.flex}>
            <Text style={themed.eyebrow}>{w('points.title')}</Text>
            <Text style={themed.rewardsTitle}>{w('points.available', { count: (preview.data?.available_points ?? 0).toLocaleString() })}</Text>
            <Text style={themed.small}>{(preview.data?.available_points ?? 0) > 0 ? w('points.applyToOrder') : w('points.earnByPurchase')}</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: usePoints }}
            accessibilityLabel={w('points.useOnPurchase')}
            disabled={!preview.data || preview.data.available_points <= 0}
            onPress={() => setUsePoints(!usePoints)}
            style={[themed.switch, usePoints && themed.switchOn, (!preview.data || preview.data.available_points <= 0) && styles.disabled]}
          >
            <View style={[styles.knob, usePoints && styles.knobOn]} />
          </Pressable>
          {usePoints && preview.data && preview.data.points_discount_amount > 0 ? (
            <Text style={themed.rewardsResult}>{w('points.youSave', { amount: money(preview.data.points_discount_amount, currency) })}</Text>
          ) : null}
        </View>
      ) : null}

      {/* web .checkout-summary */}
      <View style={[themed.card, styles.summary]}>
        <Text style={themed.eyebrow}>{w('cart.orderSummary')}</Text>
        <View>
          <View style={themed.summaryLine}><Text style={themed.summaryLabel}>{w('cart.itemsSubtotal')}</Text><Text style={themed.summaryValue}>{money(preview.data?.subtotal ?? estimated, currency)}</Text></View>
          {preview.data && preview.data.points_discount_amount > 0 ? (
            <View style={themed.summaryLine}><Text style={themed.summaryLabel}>{w('cart.pointsDiscount')}</Text><Text style={[themed.summaryValue, themed.discount]}>−{money(preview.data.points_discount_amount, currency)}</Text></View>
          ) : null}
          <View style={themed.summaryLine}><Text style={themed.summaryLabel}>{w('product.delivery')}</Text><Text style={themed.summaryValue}>{w('cart.calculatedNext')}</Text></View>
        </View>
        <View style={themed.total}>
          <Text style={themed.totalLabel}>{w('cart.totalProducts')}</Text>
          <Text style={themed.totalValue}>{money(preview.data ? preview.data.final_total : estimated, currency)}</Text>
          <Text style={themed.small}>{preview.isFetching ? w('cart.updating') : w('cart.deliveryNextStep')}</Text>
        </View>
        {profileIncomplete ? (
          <View style={themed.inlineError}><Text style={themed.inlineErrorTitle}>{w('cart.addPhoneTitle')}</Text><Text style={themed.inlineErrorText}>{w('cart.addPhoneDescription')}</Text></View>
        ) : null}
        {blockedByIssues ? <ErrorState message={t('cart.needsAttention')} /> : null}
        {preview.isError && !usePoints ? <ErrorState message={preview.error instanceof ApiError && preview.error.message ? preview.error.message : t('cart.verifyFailed')} retry={() => void preview.refetch()} /> : null}
        <Button
          variant="gold"
          title={!user ? w('cart.signInToCheckout') : profileIncomplete ? w('cart.completeProfile') : w('cart.continueToCheckout')}
          loading={createMutation.isPending}
          disabled={Boolean(user) && !profileIncomplete && (blockedByIssues || preview.isFetching)}
          onPress={startCheckout}
        />
        <Pressable onPress={() => router.push('/(buyer)/search')} accessibilityRole="link">
          <Text style={themed.secondary}>{w('cart.continueShopping')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static
 *  in `styles` so they are created once. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    h1: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 29, letterSpacing: -0.4 },
    headingSub: { color: c.muted, fontWeight: '700', marginTop: 5 },
    countPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.surface2, color: c.muted, fontSize: 14, overflow: 'hidden' },
    card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 17 },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    cardTitle: { flex: 1, color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 18 },
    cardHeadMeta: { color: c.muted, fontSize: 14 },
    row: { gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    thumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    name: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 17 },
    muted: { color: c.muted },
    small: { color: c.muted, fontSize: 14 },
    tiny: { color: c.muted, fontSize: 12 },
    unitPrice: { marginTop: 7, color: c.ink, fontWeight: '700', fontSize: 17 },
    issue: { color: c.danger, fontSize: 14, marginTop: 6 },
    stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 999 },
    stepText: { color: c.ink, fontSize: 18 },
    qty: { minWidth: 28, textAlign: 'center', fontWeight: '700', color: c.ink, fontSize: 16 },
    remove: { color: c.danger, fontSize: 12.5, fontWeight: '700' },
    lineTotalValue: { color: c.ink, fontWeight: '700', fontSize: 17 },
    rewards: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.goldSoft },
    rewardsOn: { borderColor: c.gold },
    eyebrow: { color: c.ink, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.3 },
    rewardsTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 17, marginTop: 5, marginBottom: 3 },
    rewardsResult: { width: '100%', color: c.success, fontSize: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    switch: { width: 50, height: 28, padding: 3, borderRadius: 999, backgroundColor: c.border },
    switchOn: { backgroundColor: c.green },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, borderStyle: 'dashed' },
    summaryLabel: { color: c.muted, fontSize: 14 },
    summaryValue: { color: c.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
    discount: { color: c.success },
    total: { gap: 5, paddingTop: 14, borderTopWidth: 2, borderTopColor: c.green },
    totalLabel: { color: c.ink, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
    totalValue: { color: c.ink, fontSize: 30, fontWeight: '700' },
    secondary: { textAlign: 'center', color: c.ink, fontSize: 14, fontWeight: '700' },
    inlineError: { gap: 4, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSoft },
    inlineErrorTitle: { color: c.danger, fontWeight: '700' },
    inlineErrorText: { color: c.ink, fontSize: 14 },
    emptyMark: { width: 72, height: 72, borderRadius: 20, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' },
    emptyMarkText: { color: c.onGold, fontWeight: '700' },
    emptyTitle: { color: c.ink, fontSize: 28, fontFamily: fonts.display, fontWeight: '500', textAlign: 'center' },
    emptyText: { color: c.muted, textAlign: 'center' },
  })

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: 22, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
  flex: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 },
  rowTop: { flexDirection: 'row', gap: 12 },
  info: { flex: 1, gap: 4 },
  thumbImg: { width: '100%', height: '100%' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controls: { gap: 7, alignItems: 'flex-start' },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  lineTotal: { alignItems: 'flex-end', gap: 5 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', elevation: 2 },
  knobOn: { transform: [{ translateX: 22 }] },
  summary: { gap: 16 },
})
