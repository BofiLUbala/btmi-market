import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Button, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

export default function RegisterChoiceScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={t('auth.register.choiceTitle')} />
      <Text style={styles.intro}>{t('auth.register.choiceIntro')}</Text>

      <Pressable style={[styles.choice, styles.buyer]} accessibilityRole="button" onPress={() => router.push('/auth/register-buyer')}>
        <View style={[styles.icon, { backgroundColor: colors.green }]}><Ionicons name="bag-handle-outline" size={26} color={colors.onGreen} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t('auth.register.createBuyer')}</Text>
          <Text style={styles.body}>{t('auth.register.buyerChoiceBody')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.green} />
      </Pressable>

      <Pressable style={[styles.choice, styles.seller]} accessibilityRole="button" onPress={() => router.push('/auth/register-seller')}>
        <View style={[styles.icon, { backgroundColor: colors.gold }]}><Ionicons name="storefront-outline" size={26} color={colors.ink} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t('auth.register.createSeller')}</Text>
          <Text style={styles.body}>{t('auth.register.sellerChoiceBody')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.gold} />
      </Pressable>

      <View style={styles.login}>
        <Text style={styles.body}>{t('auth.register.alreadyRegistered')}</Text>
        <Button title={t('common.signIn')} variant="outline" onPress={() => router.replace('/auth/login')} />
      </View>
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: spacing.md, gap: spacing.md },
  intro: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.sm },
  choice: { minHeight: 132, borderRadius: radius.md, borderWidth: 2, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  buyer: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  seller: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  icon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 6 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  body: { color: colors.muted, lineHeight: 20 },
  login: { marginTop: spacing.md, gap: spacing.sm, alignItems: 'center' },
})
