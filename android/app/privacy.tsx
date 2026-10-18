import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { PRIVACY_POLICY } from '../src/legal/privacy'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, spacing, type Colors } from '../src/theme'

/** Privacy policy, in the language the user picked. Reachable without an account. */
export default function PrivacyScreen() {
  const { lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const policy = PRIVACY_POLICY[lang === 'en' ? 'en' : 'fr']

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={styles.h1}>{policy.title}</Text>
        <Text style={styles.muted}>{policy.updated}</Text>
        {policy.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.h2}>{section.title}</Text>
            {section.body.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  sheet: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
  h1: { fontFamily: fonts.display, fontWeight: '700', fontSize: 22, color: c.ink },
  h2: { fontFamily: fonts.display, fontWeight: '700', fontSize: 16, color: c.ink },
  section: { gap: 6, marginTop: 8 },
  body: { color: c.ink, fontSize: 14, lineHeight: 21 },
  muted: { color: c.muted, fontSize: 13 },
})
