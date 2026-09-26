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
import type { Colors } from '../theme'
import type { TranslationKey } from '../locales/fr'

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
    { icon: 'home-outline', label: t('nav.marketplace' as TranslationKey), to: '/(buyer)' },
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
            <Text style={s.brand}>TBK</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('nav.closeMenu' as TranslationKey)} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={c.ink} />
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
                <Ionicons name={link.icon} size={19} color={c.muted} />
                <Text style={s.linkText}>{link.label}</Text>
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
    drawer: { width: '86%', maxWidth: 320, backgroundColor: c.white, elevation: 16 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    brand: { color: c.ink, fontWeight: '700', fontSize: 16 },
    nav: { padding: 12, gap: 2 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
    linkPressed: { backgroundColor: c.surface2 },
    linkText: { color: c.ink, fontSize: 16, fontWeight: '500' },
    prefs: { marginTop: 12 },
  })
