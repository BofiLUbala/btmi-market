import { useMemo } from 'react'
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button } from '../src/components/ui'
import { useAuthWide } from '../src/components/AuthWideShell'
import { categoryImage } from '../src/lib/categoryVisuals'
import { markWelcomeSeen } from '../src/lib/welcome'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../src/theme'

const LOGO = require('../assets/icon.png')

/** Reference 13 "Bienvenue": first-launch onboarding on a navy surface. */
export default function WelcomeScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const wide = useAuthWide()

  async function leave(to: Href, replace = true) {
    await markWelcomeSeen()
    if (replace) router.replace(to)
    else { router.replace('/(buyer)'); router.push(to) }
  }

  const body = <>
      <View style={styles.top}>
        <View style={styles.logoTile}><RNImage source={LOGO} style={styles.logo} resizeMode="contain" /></View>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void leave('/(buyer)')}>
          <Text style={styles.skip}>{t('welcome.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Product collage */}
        <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.photo, styles.photoLeft]}><Image source={categoryImage('fashion')} style={styles.fill} contentFit="cover" /></View>
          <View style={[styles.photo, styles.photoRight]}><Image source={categoryImage('shoes')} style={styles.fill} contentFit="cover" /></View>
          <View style={[styles.photo, styles.photoBottom]}><Image source={categoryImage('electronics')} style={styles.fill} contentFit="cover" /></View>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.badgeText}>{t('welcome.delivered')}</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          {t('welcome.headline1')}{'\n'}
          <Text style={styles.headlineAccent}>{t('welcome.headline2')}</Text>
        </Text>
        <Text style={styles.body}>{t('welcome.body')}</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Button title={t('welcome.start')} onPress={() => void leave('/auth/register-choice', false)} />
        <Text style={styles.signInLine}>
          {t('welcome.haveAccount')}{' · '}
          <Text style={styles.signInLink} accessibilityRole="link" onPress={() => void leave('/auth/login', false)}>{t('common.signIn')}</Text>
        </Text>
      </View>
  </>

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {/* Large screens: the same design, centred in a narrow column. */}
      {wide ? <View style={styles.wideColumn}>{body}</View> : body}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.navy, paddingHorizontal: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  logoTile: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: c.navySoft },
  logo: { width: 40, height: 40 },
  skip: { color: c.onNavyMuted, fontSize: 14, fontWeight: '600' },
  scroll: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: spacing.md },
  collage: { height: 300, marginBottom: spacing.lg },
  photo: { position: 'absolute', borderRadius: 20, overflow: 'hidden', backgroundColor: c.navySoft, borderWidth: 3, borderColor: c.navySoft, ...shadow.card },
  photoLeft: { left: 0, top: 24, width: '48%', height: 190, transform: [{ rotate: '-6deg' }] },
  photoRight: { right: 0, top: 0, width: '50%', height: 170, transform: [{ rotate: '5deg' }] },
  photoBottom: { right: '8%', bottom: 0, width: '42%', height: 130, transform: [{ rotate: '-3deg' }] },
  fill: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: '22%', top: 170, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, ...shadow.card },
  badgeText: { color: '#0B1530', fontSize: 12, fontWeight: '700' },
  headline: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  headlineAccent: { color: c.cyan },
  body: { color: c.onNavyMuted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  actions: { gap: 14, paddingTop: spacing.sm },
  signInLine: { color: c.onNavyMuted, fontSize: 13, textAlign: 'center' },
  signInLink: { color: c.onNavy, fontWeight: '700' },
  wideColumn: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
})
