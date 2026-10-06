import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../api'
import { fetchBuyerUnreadCounts } from '../api/communication'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { canBuy, canSell } from '../types'
import { kicker, shadow, spacing, type Colors } from '../theme'
import { BrandLogo } from './BrandLogo'
import { BuyerMenu } from './BuyerMenu'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  onSubmit: () => void
  onCamera: () => void
  onGallery: () => void
  onFilters: () => void
}

/**
 * Large-screen storefront header: the logo, then ONE card holding everything
 * else (delivery place, search with photo search and filters, the main
 * sections, account, notifications, menu). Large screens have no bottom tab
 * bar, so the sections it carried live here.
 */
export function WideTopBar({ search, onSearchChange, onSubmit, onCamera, onGallery, onFilters }: Props) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useAuth((state) => state.user)
  const isBuyer = Boolean(user) && canBuy(user)
  const isSeller = canSell(user)
  const cartCount = useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))
  // Same cache entries as the home and account screens.
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: isBuyer })
  const unread = useQuery({ queryKey: ['buyer', 'unread-counts'], queryFn: fetchBuyerUnreadCounts, enabled: isBuyer, refetchInterval: 60_000 })
  const unreadNotifications = unread.data?.unread_notifications ?? 0
  const commune = profile.data?.commune?.trim()
  const deliveryPlace = commune ? [commune, profile.data?.city?.trim()].filter(Boolean).join(', ') : ''

  const openSell = () => {
    if (isSeller) router.push('/seller/products/create')
    else if (user) router.navigate('/(buyer)/profile')
    else router.push('/auth/register-seller')
  }

  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, badge = 0) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>
      <Ionicons name={name} size={20} color={c.ink} />
      {badge > 0 ? <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  )
  const link = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, badge = 0) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="link" style={({ pressed }) => [s.navLink, pressed && s.pressed]}>
      <View>
        <Ionicons name={name} size={19} color={c.ink} />
        {badge > 0 ? <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
      </View>
      <Text style={s.navText} numberOfLines={1}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Pressable onPress={() => router.navigate('/')} accessibilityRole="link" accessibilityLabel={t('home.logoAlt')}>
          <BrandLogo size={44} />
        </Pressable>
        <View style={s.card}>
          {deliveryPlace ? <Pressable onPress={() => router.push('/profile-edit')} accessibilityRole="button" style={s.deliver}>
            <Text style={s.deliverKicker}>{t('browse.deliverTo')}</Text>
            <View style={s.deliverRow}>
              <Text style={s.deliverPlace} numberOfLines={1}>{deliveryPlace}</Text>
              <Ionicons name="chevron-down" size={13} color={c.ink} />
            </View>
          </Pressable> : null}
          <View style={s.search}>
            <Ionicons name="search-outline" size={17} color={c.muted} />
            <View style={s.inputWrap}>
              {!search ? <Text style={s.placeholder} numberOfLines={1} pointerEvents="none">{t('search.placeholder')}</Text> : null}
              <TextInput value={search} onChangeText={onSearchChange} onSubmitEditing={onSubmit} returnKeyType="search" style={s.input} />
            </View>
            {search.length > 0 ? <Pressable onPress={() => onSearchChange('')} accessibilityLabel={t('home.clearSearch')} hitSlop={6}><Ionicons name="close" size={17} color={c.muted} /></Pressable> : null}
            <Pressable style={s.inline} onPress={onCamera} accessibilityRole="button" accessibilityLabel={t('home.takePhotoSearch')}><Ionicons name="camera-outline" size={19} color={c.muted} /></Pressable>
            <Pressable style={s.inline} onPress={onGallery} accessibilityRole="button" accessibilityLabel={t('home.chooseImageSearch')}><Ionicons name="image-outline" size={19} color={c.muted} /></Pressable>
            <Pressable style={({ pressed }) => [s.filter, pressed && s.pressed]} onPress={onFilters} accessibilityRole="button" accessibilityLabel={t('browse.filters')}>
              <Ionicons name="options-outline" size={18} color={c.onGreen} />
            </Pressable>
          </View>
          <View style={s.nav}>
            {link('grid-outline', t('nav.categories'), () => router.navigate('/(buyer)/categories'))}
            {link('cube-outline', t('nav.orders'), () => router.navigate('/(buyer)/my-orders'))}
            {link('bag-handle-outline', t('nav.cart'), () => router.navigate('/(buyer)/cart'), cartCount)}
            <Pressable onPress={openSell} accessibilityRole="button" style={({ pressed }) => [s.sell, pressed && s.pressed]}>
              <Ionicons name="add" size={18} color={c.onGreen} />
              <Text style={s.sellText}>{t('nav.sell')}</Text>
            </Pressable>
          </View>
          <View style={s.divider} />
          {icon('person-outline', t('nav.account'), () => router.navigate(user ? '/(buyer)/profile' : '/auth/login'))}
          {icon('notifications-outline', t('notifications.title'), () => router.push(user ? '/notifications' : '/auth/login'), unreadNotifications)}
          {icon('menu', t('nav.openMenu'), () => setMenuOpen(true))}
        </View>
      </View>
      <BuyerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  wrap: { backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 12, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  card: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, ...shadow.card },
  deliver: { maxWidth: 170, paddingRight: 6 },
  deliverKicker: { ...kicker, fontSize: 9.5, color: c.muted },
  deliverRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deliverPlace: { flexShrink: 1, color: c.ink, fontSize: 13.5, fontWeight: '700' },
  search: { flex: 1, minWidth: 180, height: 44, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 4 },
  inputWrap: { flex: 1, minWidth: 60, justifyContent: 'center' },
  placeholder: { position: 'absolute', left: 0, right: 0, color: c.faint, fontSize: 14 },
  input: { color: c.ink, fontSize: 14, paddingVertical: 0, paddingHorizontal: 0 },
  inline: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filter: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 40, borderRadius: 10 },
  navText: { color: c.ink, fontSize: 13.5, fontWeight: '600' },
  sell: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: c.green, marginLeft: 4 },
  sellText: { color: c.onGreen, fontSize: 13.5, fontWeight: '700' },
  divider: { width: 1, height: 28, backgroundColor: c.border },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -6, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.onGreen, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.75 },
})
