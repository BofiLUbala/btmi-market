import { useMemo } from 'react'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../src/store/auth'
import { Button, Card, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function SellerProfileScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const user = useAuth((s) => s.user)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const logout = useAuth((s) => s.logout)

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.profile.title')} />
    <View style={styles.grid}>
      <Card><Text style={styles.cardTitle}>{t('seller.accountType')}</Text><Text style={styles.metric}>{user?.account_type || '—'}</Text></Card>
      <Card><Text style={styles.cardTitle}>{t('seller.activeBusiness')}</Text><Text style={styles.metric}>{activeBusiness?.name || t('common.none')}</Text></Card>
    </View>

    <Card>
      <Text style={styles.cardTitle}>{t('seller.accountInfo')}</Text>
      <Text style={styles.muted}>{t('seller.accountInfoNote')}</Text>
      <View style={styles.field}><Text style={styles.label}>{t('common.name')}</Text><Text style={styles.value}>{user ? `${user.first_name} ${user.last_name}` : '—'}</Text></View>
      <View style={styles.field}><Text style={styles.label}>{t('auth.email')}</Text><Text style={styles.value}>{user?.email || '—'}</Text></View>
      <View style={styles.field}><Text style={styles.label}>{t('auth.phone')}</Text><Text style={styles.value}>{user?.phone || '—'}</Text></View>
      <Button variant="outline" title={t('editProfile.title')} onPress={() => router.push('/profile-edit')} />
    </Card>

    <Card>
      <Text style={styles.cardTitle}>{t('seller.session')}</Text>
      <Text style={styles.muted}>{t('seller.sessionNote')}</Text>
      <Button variant="outline" title={t('common.signOut')} onPress={() => void logout()} />
    </Card>
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  muted: { color: colors.muted },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  metric: { fontSize: 18, fontWeight: '900', color: colors.green },
  grid: { flexDirection: 'row', gap: spacing.sm },
  field: { paddingVertical: spacing.xs },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.ink, fontWeight: '700', fontSize: 15 },
})
