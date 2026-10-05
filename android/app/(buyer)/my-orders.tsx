import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import OrdersScreen from '../orders/index'
import { Button } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, spacing, type Colors } from '../../src/theme'

// The reference design puts "Commandes" in the bottom bar. Signed in, the tab
// is the same order history as /orders; a guest gets the sign-in prompt the
// account screen shows (the history needs an account).
export default function MyOrdersTab() {
  const signedIn = useAuth((state) => Boolean(state.user))
  const c = useColors()
  const { t } = useI18n()
  const s = useMemo(() => makeStyles(c), [c])
  if (signedIn) return <OrdersScreen />
  return (
    <View style={s.center}>
      <View style={s.tile}><Ionicons name="cube-outline" size={28} color={c.green} /></View>
      <Text style={s.title}>{t('profile.myOrders')}</Text>
      <Text style={s.muted}>{t('profile.signInPrompt')}</Text>
      <Button title={t('common.signIn')} onPress={() => router.push('/auth/login')} style={s.button} />
      <Button title={t('auth.createAccount')} variant="outline" onPress={() => router.push('/auth/register-choice')} style={s.button} />
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, backgroundColor: c.cream },
  tile: { width: 64, height: 64, borderRadius: 18, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  title: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 20 },
  muted: { color: c.muted, textAlign: 'center', marginBottom: spacing.sm },
  button: { alignSelf: 'stretch' },
})
