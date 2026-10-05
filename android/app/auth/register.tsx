import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'

export default function RegisterScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return <ScrollView style={styles.root} contentContainerStyle={styles.page}>
    <View style={styles.hero}>
      <Text style={styles.headline}>{t('auth.register.choiceTitle')}</Text>
      <Text style={styles.intro}>{t('auth.register.choiceIntro')}</Text>
    </View>

    <Pressable style={[styles.choice, styles.buyer]} accessibilityRole="button" accessibilityLabel={t('auth.register.createBuyer')} onPress={() => router.push('/auth/register-buyer')}>
      <View style={[styles.icon, { backgroundColor: colors.green }]}><Ionicons name="bag-handle-outline" size={26} color={colors.onGreen} /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('auth.register.createBuyer')}</Text>
        <Text style={styles.body}>{t('auth.register.buyerChoiceBody')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onNavyMuted} />
    </Pressable>

    <Pressable style={[styles.choice, styles.seller]} accessibilityRole="button" accessibilityLabel={t('auth.register.createSeller')} onPress={() => router.push('/auth/register-seller')}>
      <View style={[styles.icon, { backgroundColor: colors.navyLine }]}><Ionicons name="storefront-outline" size={26} color={colors.cyan} /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('auth.register.createSeller')}</Text>
        <Text style={styles.body}>{t('auth.register.sellerChoiceBody')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onNavyMuted} />
    </Pressable>

    <Text style={styles.login}>
      {t('auth.register.alreadyRegistered')}{' · '}
      <Text style={styles.loginLink} accessibilityRole="link" onPress={() => router.replace('/auth/login')}>{t('common.signIn')}</Text>
    </Text>
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  // Reference 13: navy welcome surface (dark in both themes).
  root: { flex: 1, backgroundColor: colors.navy },
  page: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.xl, gap: 12 },
  hero: { gap: 10, marginBottom: spacing.md, paddingHorizontal: 4 },
  headline: { color: colors.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  intro: { color: colors.onNavyMuted, fontSize: 14, lineHeight: 21 },
  choice: { minHeight: 96, borderRadius: 18, borderWidth: 1, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 14 },
  buyer: { backgroundColor: colors.navySoft, borderColor: colors.green, ...shadow.raised },
  seller: { backgroundColor: colors.navySoft, borderColor: colors.navyLine },
  icon: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.onNavy, fontSize: 16, fontWeight: '700' },
  body: { color: colors.onNavyMuted, fontSize: 13, lineHeight: 19 },
  login: { marginTop: spacing.md, color: colors.onNavyMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  loginLink: { color: colors.onNavy, fontWeight: '700' },
})
