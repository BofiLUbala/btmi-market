import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { authApi } from '../api'
import { useAuth } from '../store/auth'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { canBuy, canOnboardSeller, canSell } from '../types'
import { radius, type Colors } from '../theme'

/**
 * Buyer / seller switch. One TBK account (one e-mail or WhatsApp number) can
 * hold both spaces: the switch opens the other one, or creates it when the
 * account does not have it yet (become-seller then the shop set-up, or
 * become-buyer). `current` is the space the screen belongs to; `dark` is for
 * the navy sidebars.
 */
export function SpaceSwitcher({ current, dark = false }: { current: 'buyer' | 'seller'; dark?: boolean }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c, dark), [c, dark])
  const { t } = useI18n()
  const user = useAuth((st) => st.user)
  const [busy, setBusy] = useState<'buyer' | 'seller' | null>(null)
  if (!user) return null
  const hasBuyer = canBuy(user)
  const hasSeller = canSell(user)
  const accent = dark ? c.cyan : c.green

  const open = async (target: 'buyer' | 'seller') => {
    if (target === current || busy) return
    try {
      if (target === 'seller') {
        if (hasSeller) { router.navigate('/seller'); return }
        if (canOnboardSeller(user)) { router.push('/seller/onboarding'); return }
        setBusy('seller')
        await authApi.becomeSeller()
        await useAuth.getState().refresh()
        router.push('/seller/onboarding')
      } else {
        if (hasBuyer) { router.navigate('/(buyer)/profile'); return }
        setBusy('buyer')
        await authApi.becomeBuyer()
        await useAuth.getState().refresh()
        router.navigate('/(buyer)/profile')
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.actionImpossible'))
    } finally {
      setBusy(null)
    }
  }

  const tab = (target: 'buyer' | 'seller', icon: keyof typeof Ionicons.glyphMap, label: string, owned: boolean) => {
    const on = current === target
    return (
      <Pressable key={target} onPress={() => void open(target)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={({ pressed }) => [s.tab, on && s.tabOn, pressed && !on && s.pressed]}>
        {busy === target ? <ActivityIndicator size="small" color={on ? c.onGreen : accent} /> : <Ionicons name={icon} size={16} color={on ? c.onGreen : accent} />}
        <View style={{ flexShrink: 1 }}>
          <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{label}</Text>
          {!on && !owned ? <Text style={s.create} numberOfLines={1}>{t('space.create')}</Text> : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={s.wrap} accessibilityRole="tablist" accessibilityLabel={t('space.switch')}>
      {tab('buyer', 'bag-handle-outline', t('space.buyer'), hasBuyer)}
      {tab('seller', 'storefront-outline', t('space.seller'), hasSeller || canOnboardSeller(user))}
    </View>
  )
}

const makeStyles = (c: Colors, dark: boolean) => StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: dark ? c.navySoft : c.surface2, borderWidth: 1, borderColor: dark ? c.navyLine : c.border },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, borderRadius: radius.sm },
  tabOn: { backgroundColor: c.green },
  pressed: { opacity: 0.75 },
  label: { color: dark ? c.onNavyMuted : c.ink, fontSize: 14, fontWeight: '700' },
  labelOn: { color: c.onGreen },
  create: { color: dark ? c.cyan : c.green, fontSize: 11, fontWeight: '700' },
})
