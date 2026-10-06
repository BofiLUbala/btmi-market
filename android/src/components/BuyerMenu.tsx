import { useMemo } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, type Href } from 'expo-router'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { PreferenceToggles } from './PreferenceToggles'
import { fonts, type Colors } from '../theme'
import type { TranslationKey } from '../locales/fr'
import { BrandLogo } from './BrandLogo'

type IconName = keyof typeof Ionicons.glyphMap

/**
 * Side drawer opened by the header's menu button — the native twin of the
 * web header drawer (same links, same order, preferences at the bottom).
 */
export function BuyerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const user = useAuth((state) => state.user)
  const cartQty = useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))
  const isSeller = user?.account_type === 'SELLER' || user?.account_type === 'EMPLOYEE'

  const links: Array<{ icon: IconName; label: string; to: Href }> = [
    { icon: 'home-outline', label: t('nav.marketplace' as TranslationKey), to: '/' },
    { icon: 'grid-outline', label: t('nav.categories' as TranslationKey), to: '/(buyer)/categories' },
    { icon: 'heart-outline', label: t('nav.favorites' as TranslationKey), to: '/(buyer)/favorites' },
    { icon: 'bag-handle-outline', label: `${t('nav.cart' as TranslationKey)}${cartQty > 0 ? ` (${cartQty})` : ''}`, to: '/(buyer)/cart' },
    ...(user ? [{ icon: 'notifications-outline' as IconName, label: t('notifications.title' as TranslationKey), to: '/notifications' as Href }] : []),
    user
      ? isSeller
        ? { icon: 'storefront-outline', label: t('nav.sellerHub' as TranslationKey), to: '/seller' }
        : { icon: 'person-outline', label: t('nav.account' as TranslationKey), to: '/(buyer)/profile' }
      : { icon: 'log-in-outline', label: t('common.signIn'), to: '/auth/login' },
  ]

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <View style={[s.drawer, { paddingTop: insets.top }]}>
          <View style={s.head}>
            <BrandLogo size={36} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('nav.closeMenu' as TranslationKey)} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={c.onNavy} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.nav}>
            {links.map((link) => (
              <Pressable
                key={link.label}
                accessibilityRole="link"
                style={({ pressed }) => [s.link, pressed && s.linkPressed]}
                onPress={() => {
                  onClose()
                  router.push(link.to)
                }}
              >
                <View style={s.tile}><Ionicons name={link.icon} size={17} color={c.green} /></View>
                <Text style={s.linkText}>{link.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.faint} />
              </Pressable>
            ))}
            <View style={s.prefs}><PreferenceToggles /></View>
          </ScrollView>
        </View>
        <Pressable style={s.backdrop} accessibilityLabel={t('nav.closeMenu' as TranslationKey)} onPress={onClose} />
      </View>
    </Modal>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: { flex: 1, flexDirection: 'row' },
    drawer: { width: '86%', maxWidth: 320, backgroundColor: c.cream, elevation: 16 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    // Navy brand strip, like the account header.
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 18, backgroundColor: c.navy },
    nav: { padding: 12, gap: 6 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
    linkPressed: { backgroundColor: c.surface2 },
    tile: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
    linkText: { flex: 1, color: c.ink, fontSize: 14, fontWeight: '600' },
    prefs: { marginTop: 10 },
  })
