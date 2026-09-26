import { useMemo } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../src/store/auth'
import { AvatarPicker } from '../../src/components/AvatarPicker'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, type Colors } from '../../src/theme'

// Port of web-app/src/pages/seller/profile/SellerProfilePage.tsx: account type,
// active business and member-since cards, the read-only account information
// (photo upload, name, email, phone, city, commune, status) and the session card.
export default function SellerProfileScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const user = useAuth((s) => s.user)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const logout = useAuth((s) => s.logout)
  const active = user?.status === 'ACTIVE'

  const info: Array<{ label: string; value: string } | null> = [
    { label: t('common.name'), value: [user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ') || '—' },
    { label: t('common.email'), value: user?.email || '—' },
    { label: t('common.phone'), value: user?.phone || '—' },
    { label: t('common.city'), value: user?.city || activeBusiness?.city || '—' },
    user?.commune ? { label: t('common.commune'), value: user.commune } : null,
  ]

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.h1}>{t('seller.profile.title')}</Text>

    <View style={styles.card}><Text style={styles.h3}>{t('seller.accountType')}</Text><Text style={styles.stat}>{user?.account_type || '—'}</Text></View>
    <View style={styles.card}><Text style={styles.h3}>{t('seller.activeBusiness')}</Text><Text style={styles.stat}>{activeBusiness?.name || t('common.none')}</Text></View>
    <View style={styles.card}><Text style={styles.h3}>{t('common.memberSince')}</Text><Text style={styles.stat}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</Text></View>

    <View style={styles.card}>
      <Text style={styles.h2}>{t('seller.accountInfo')}</Text>
      <Text style={styles.small}>{t('seller.accountInfoNote')}</Text>
      <View style={{ marginTop: 16 }}><AvatarPicker size={72} name={user ? `${user.first_name} ${user.last_name}` : ''} /></View>
      {info.filter(Boolean).map((row) => <View key={row!.label} style={styles.field}>
        <Text style={styles.small}>{row!.label}</Text>
        <Text style={styles.value}>{row!.value}</Text>
      </View>)}
      <View style={styles.field}>
        <Text style={styles.small}>{t('common.status')}</Text>
        <Text style={[styles.badge, active ? { backgroundColor: colors.successSoft, color: colors.success } : { backgroundColor: colors.warningSoft, color: colors.warning }]}>{user?.status || '—'}</Text>
      </View>
    </View>

    <View style={styles.card}>
      <Text style={styles.h3}>{t('seller.session')}</Text>
      <Text style={styles.small}>{t('seller.sessionNote')}</Text>
      <Pressable accessibilityRole="button" style={styles.danger} onPress={async () => { await logout(); router.replace('/auth/login') }}>
        <Text style={styles.dangerText}>{t('common.signOut')}</Text>
      </Pressable>
    </View>
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink },
  h3: { fontSize: 16, fontWeight: '700', color: c.ink },
  stat: { fontSize: 22.4, fontWeight: '800', color: c.ink, marginTop: 8 },
  small: { color: c.muted, fontSize: 14 },
  value: { color: c.ink, fontSize: 16 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  field: { marginTop: 16, gap: 2, alignItems: 'flex-start' },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  danger: { marginTop: 16, alignSelf: 'flex-start', backgroundColor: c.danger, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  dangerText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
})
