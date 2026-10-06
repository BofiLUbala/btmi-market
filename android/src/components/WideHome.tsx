import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { Category, PublicProduct } from '../types'
import { resolveMediaUrl } from '../api/client'
import { categoryImage } from '../lib/categoryVisuals'
import { categoryLabel } from '../lib/categoryLabels'
import { formatMoney } from '../lib/money'
import { resolvePromotion } from '../lib/promotion'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../theme'

/**
 * Large-screen home (web / tablets, width >= WIDE_BREAKPOINT):
 *  - three spotlight cards fed by the backend (one product each, rotated
 *    server-side from the seller performance ranking);
 *  - a category feed that alternates, Amazon-style: a full-width strip of
 *    products from different categories, then a row of big "four items of
 *    one category" cards, and again, until every listing is placed.
 */
export const WIDE_BREAKPOINT = 900

const UNSORTED = '__unsorted'

function photo(p: PublicProduct) {
  const first = p.images?.[0]
  const raw = p.primary_image_url || p.image_url || (typeof first === 'string' ? first : first?.url || first?.image_url)
  return resolveMediaUrl(raw) ?? categoryImage(p.category_slug, p.category_name)
}

function priceOf(p: PublicProduct) {
  const promo = resolvePromotion(p, p.base_price || p.price || 0)
  const price = promo.effectivePrice || p.sale_price || p.price || p.base_price || 0
  return { price, promo, onSale: promo.phase === 'active' && promo.discountPercent > 0 }
}

const openProduct = (p: PublicProduct) => router.push(`/products/${p.id}`)

type IconName = keyof typeof Ionicons.glyphMap

/* ------------------------------------------------------------------ */
/* Spotlights                                                          */
/* ------------------------------------------------------------------ */

/**
 * The three spotlights come from the backend (GET /marketplace/spotlights):
 * it rebuilds the candidate pools in the background (newest listings,
 * running offers, listings of the best-performing sellers by the marketplace
 * ranking score) and serves one product per card for a fixed slot. A card
 * shows that single product and cross-fades when the backend moves on.
 */
export function Spotlights({ data }: { data?: { new: PublicProduct | null; offer: PublicProduct | null; best: PublicProduct | null } }) {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const cards: { key: string; title: string; icon: IconName; item: PublicProduct | null | undefined }[] = [
    { key: 'new', title: t('home.spot.new'), icon: 'sparkles-outline', item: data?.new },
    { key: 'offers', title: t('home.spot.offers'), icon: 'pricetag-outline', item: data?.offer },
    { key: 'best', title: t('home.spot.best'), icon: 'trophy-outline', item: data?.best },
  ]
  return (
    <View style={s.spotRow}>
      {cards.map((card, index) => <SpotlightCard key={card.key} title={card.title} icon={card.icon} item={card.item} tone={index} />)}
    </View>
  )
}

function SpotlightCard({ title, icon, item, tone }: { title: string; icon: IconName; item: PublicProduct | null | undefined; tone: number }) {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const fade = useRef(new Animated.Value(1)).current
  const [shown, setShown] = useState(item)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(v) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Cross-fade only when the backend hands over a different product.
  useEffect(() => {
    if (item?.id === shown?.id) { if (item !== shown) setShown(item); return }
    if (!shown || reduceMotion) { setShown(item); return }
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setShown(item)
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start()
    })
  }, [item, shown, fade, reduceMotion])

  const bg = tone === 0 ? c.green : tone === 1 ? c.navy : c.gold

  if (!shown) {
    // Nothing qualifies right now (e.g. no running offer): say so plainly.
    return (
      <View style={[s.spot, { backgroundColor: bg }]}>
        <View style={s.spotGlow} pointerEvents="none" />
        <View style={s.spotHead}><Ionicons name={icon} size={16} color={c.onNavy} /><Text style={s.spotKicker}>{title}</Text></View>
        <Text style={s.spotEmptyTitle}>{t('browse.heroTitle')}</Text>
        <Text style={s.spotEmptyText}>{t('home.spot.empty')}</Text>
      </View>
    )
  }

  const { price, promo, onSale } = priceOf(shown)
  return (
    <Pressable
      onPress={() => openProduct(shown)}
      style={({ pressed }) => [s.spot, { backgroundColor: bg }, pressed && s.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`${title}: ${shown.name}`}
    >
      <View style={s.spotGlow} pointerEvents="none" />
      <View style={s.spotHead}><Ionicons name={icon} size={16} color={c.onNavy} /><Text style={s.spotKicker}>{title}</Text></View>
      <Animated.View style={[s.spotBody, { opacity: fade }]}>
        <View style={s.spotText}>
          {shown.category_name ? <Text style={s.spotCat} numberOfLines={1}>{categoryLabel(t, shown.category_slug, shown.category_name)}</Text> : null}
          <Text style={s.spotName} numberOfLines={2}>{shown.name}</Text>
          <Text style={s.spotShop} numberOfLines={1}>{shown.shop_name}</Text>
          <View style={s.spotPriceRow}>
            <Text style={s.spotPrice}>{formatMoney(price, shown.currency)}</Text>
            {onSale ? <Text style={s.spotStrike}>{formatMoney(promo.originalPrice, shown.currency)}</Text> : null}
            {onSale ? <View style={s.spotBadge}><Text style={s.spotBadgeText}>-{promo.discountPercent}%</Text></View> : null}
          </View>
        </View>
        <Image source={photo(shown)} style={s.spotImage} contentFit="cover" transition={200} />
      </Animated.View>
    </Pressable>
  )
}

/* ------------------------------------------------------------------ */
/* Category feed                                                        */
/* ------------------------------------------------------------------ */

interface Group { slug: string; name: string; items: PublicProduct[] }
type Block = { kind: 'quad'; groups: Group[] } | { kind: 'strip'; items: PublicProduct[] }

const groupOf = (p: PublicProduct) => p.category_slug || UNSORTED

/** Turns the loaded listings into alternating blocks until every listing is
 *  shown once: a full-width strip of `stripSize` products, each from a
 *  different category (rotating through all categories), then a row of big
 *  cards with up to four products of one category each, then a strip again. */
export function buildFeed(products: PublicProduct[], categories: Category[], columns: number, stripSize: number): Block[] {
  const bySlug = new Map<string, Group>()
  for (const p of products) {
    // Listings without a category share one card (labelled "picked for you").
    const slug = groupOf(p)
    const g = bySlug.get(slug) ?? { slug, name: p.category_name || slug, items: [] }
    if (!g.items.some((x) => x.id === p.id)) g.items.push(p)
    bySlug.set(slug, g)
  }
  const order = new Map(categories.map((cat, i) => [cat.slug, i]))
  const groups = [...bySlug.values()].sort((a, b) => b.items.length - a.items.length || (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99))
  // Not-yet-shown listings per category, in ranking order.
  const left = new Map(groups.map((g) => [g.slug, [...g.items]]))
  const remaining = () => [...left.values()].reduce((n, l) => n + l.length, 0)

  let cursor = 0 // where the next strip starts, so strips rotate categories
  const takeStrip = (): PublicProduct[] => {
    const row: PublicProduct[] = []
    for (let k = 0; k < groups.length && row.length < stripSize; k++) {
      const g = groups[(cursor + k) % groups.length]
      const l = left.get(g.slug)!
      if (l.length) row.push(l.shift()!)
    }
    cursor = (cursor + stripSize) % Math.max(1, groups.length)
    return row
  }
  const takeCards = (): Group[] => groups
    .filter((g) => left.get(g.slug)!.length)
    .sort((a, b) => left.get(b.slug)!.length - left.get(a.slug)!.length)
    .slice(0, columns)
    .map((g) => ({ ...g, items: left.get(g.slug)!.splice(0, 4) }))

  const blocks: Block[] = []
  let stripTurn = true
  while (remaining() > 0) {
    if (stripTurn) {
      const row = takeStrip()
      // Fewer than three categories left: not worth a strip, show cards.
      if (row.length >= 3) blocks.push({ kind: 'strip', items: row })
      else row.forEach((p) => left.get(groupOf(p))!.unshift(p))
    } else {
      const lastCategory = groups.filter((g) => left.get(g.slug)!.length).length === 1
      blocks.push({ kind: 'quad', groups: takeCards() })
      // One category left: a single card is enough, its "see all" link
      // leads to the rest instead of repeating the same category row after row.
      if (lastCategory) break
    }
    stripTurn = !stripTurn
  }
  return blocks
}

export function CategoryFeed({ products, categories, columns }: { products: PublicProduct[]; categories: Category[]; columns: number }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const stripSize = columns + 1
  const blocks = useMemo(() => buildFeed(products, categories, columns, stripSize), [products, categories, columns, stripSize])
  return (
    <View style={s.feed}>
      {blocks.map((block, i) => block.kind === 'quad'
        ? <View key={`q${i}`} style={s.quadRow}>{block.groups.map((g) => <QuadCard key={g.slug} group={g} />)}{fillers(columns - block.groups.length, s.quadFiller)}</View>
        : <StripRow key={`s${i}`} items={block.items} size={stripSize} />)}
    </View>
  )
}

/** Invisible cells so a short row keeps the same column widths. */
function fillers(n: number, style: object) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => <View key={`f${i}`} style={style} />)
}

function StripRow({ items, size }: { items: PublicProduct[]; size: number }) {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  return (
    <View style={s.strip}>
      {items.map((p) => {
        const { price, onSale, promo } = priceOf(p)
        return (
          <Pressable key={p.id} onPress={() => openProduct(p)} style={({ pressed }) => [s.stripItem, pressed && s.pressed]} accessibilityRole="link" accessibilityLabel={p.name}>
            <View>
              <Image source={photo(p)} style={s.stripImage} contentFit="cover" transition={150} />
              {onSale ? <View style={s.stripBadge}><Text style={s.spotBadgeText}>-{promo.discountPercent}%</Text></View> : null}
            </View>
            {p.category_name ? <Text style={s.stripCat} numberOfLines={1}>{categoryLabel(t, p.category_slug, p.category_name)}</Text> : null}
            <Text style={s.stripName} numberOfLines={2}>{p.name}</Text>
            <Text style={s.quadPrice}>{formatMoney(price, p.currency)}</Text>
          </Pressable>
        )
      })}
      {fillers(size - items.length, s.stripItem)}
    </View>
  )
}

function QuadCard({ group }: { group: Group }) {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const label = group.slug === UNSORTED ? t('home.pickedForYou') : categoryLabel(t, group.slug, group.name)
  const four = group.items.slice(0, 4)
  return (
    <View style={s.quad}>
      <Text style={s.quadTitle} numberOfLines={1}>{label}</Text>
      <View style={s.quadGrid}>
        {four.map((p) => {
          const { price } = priceOf(p)
          return (
            <Pressable key={p.id} onPress={() => openProduct(p)} style={({ pressed }) => [s.quadItem, pressed && s.pressed]} accessibilityRole="link" accessibilityLabel={p.name}>
              <Image source={photo(p)} style={s.quadImage} contentFit="cover" transition={150} />
              <Text style={s.quadName} numberOfLines={1}>{p.name}</Text>
              <Text style={s.quadPrice}>{formatMoney(price, p.currency)}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={s.quadFoot}>
        <Pressable onPress={() => router.push(group.slug === UNSORTED ? '/(buyer)/categories' : `/categories/${group.slug}`)} hitSlop={6} accessibilityRole="link">
          <Text style={s.more}>{group.slug === UNSORTED ? t('common.viewAll') : t('home.feed.explore', { category: label })}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  pressed: { opacity: 0.9 },
  flex: { flex: 1, minWidth: 0 },
  // Spotlights
  spotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: spacing.md, marginBottom: 20, width: '100%', maxWidth: 1480, alignSelf: 'center' },
  spot: { flex: 1, minWidth: 260, minHeight: 196, borderRadius: 20, padding: 18, overflow: 'hidden', gap: 10, ...shadow.raised },
  spotGlow: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.10)' },
  spotHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spotKicker: { ...kicker, color: c.onNavy, opacity: 0.92 },
  spotBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  spotText: { flex: 1, minWidth: 0, gap: 4 },
  spotCat: { ...kicker, fontSize: 9.5, color: c.onNavyMuted },
  spotName: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  spotShop: { color: c.onNavyMuted, fontSize: 12.5 },
  spotPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  spotPrice: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 20 },
  spotStrike: { color: c.onNavyMuted, fontSize: 13, textDecorationLine: 'line-through' },
  spotBadge: { backgroundColor: c.onNavy, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  spotBadgeText: { color: c.green, fontWeight: '800', fontSize: 11 },
  spotImage: { width: 118, height: 118, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  spotEmptyTitle: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 18, lineHeight: 22 },
  spotEmptyText: { color: c.onNavyMuted, fontSize: 13, lineHeight: 18 },
  // Feed
  feed: { paddingHorizontal: spacing.md, gap: 20, paddingBottom: 28, width: '100%', maxWidth: 1480, alignSelf: 'center' },
  quadRow: { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  quadFiller: { flex: 1 },
  strip: { flexDirection: 'row', gap: 14, backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: 16, ...shadow.card },
  stripItem: { flex: 1, minWidth: 0, gap: 4 },
  stripImage: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
  stripBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.white, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stripCat: { ...kicker, fontSize: 9.5, color: c.green, marginTop: 4 },
  stripName: { color: c.ink, fontSize: 13, fontWeight: '600', lineHeight: 17, minHeight: 34 },
  quad: { flex: 1, minWidth: 0, backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12, ...shadow.card },
  quadTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 17, letterSpacing: -0.3 },
  quadGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  quadItem: { width: '48%', gap: 4 },
  quadImage: { width: '100%', aspectRatio: 1, maxHeight: 150, borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
  quadName: { color: c.ink, fontSize: 12.5, fontWeight: '600' },
  quadPrice: { color: c.green, fontFamily: fonts.display, fontWeight: '700', fontSize: 14 },
  quadFoot: { marginTop: 'auto' },
  more: { color: c.green, fontWeight: '700', fontSize: 13 },
})
