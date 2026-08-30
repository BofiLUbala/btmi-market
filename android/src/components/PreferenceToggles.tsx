import { Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n } from '../store/i18n'
import { useTheme } from '../store/theme'
import { radius, spacing } from '../theme'

/** Language + theme switches. Each control shows the state you would switch
 *  *to*, so it reads as an action rather than a status. */
export function PreferenceToggles() {
  const { lang, toggleLang, t } = useI18n()
  const { theme, toggleTheme, colors } = useTheme()
  const goingDark = theme === 'light'

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.white }]}>
      <Pressable
        onPress={toggleLang}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={lang === 'fr' ? t('prefs.switchToEnglish') : t('prefs.switchToFrench')}
      >
        <Ionicons name="language-outline" size={18} color={colors.muted} />
        <Text style={[styles.label, { color: colors.ink }]}>{t('prefs.language')}</Text>
        <Text style={[styles.value, { color: colors.green }]}>{lang === 'fr' ? 'FR' : 'EN'}</Text>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Pressable
        onPress={toggleTheme}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={goingDark ? t('prefs.switchToDark') : t('prefs.switchToLight')}
      >
        <Ionicons name={goingDark ? 'moon-outline' : 'sunny-outline'} size={18} color={colors.muted} />
        <Text style={[styles.label, { color: colors.ink }]}>{t('prefs.theme')}</Text>
        <Text style={[styles.value, { color: colors.green }]}>
          {theme === 'dark' ? t('prefs.themeDark') : t('prefs.themeLight')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.md },
  label: { flex: 1, fontWeight: '700', fontSize: 15 },
  value: { fontWeight: '900', fontSize: 14 },
  divider: { height: 1, marginHorizontal: spacing.md },
})
