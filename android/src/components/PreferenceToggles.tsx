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

/** Compact variant for a top bar: two icon-sized buttons, no text labels.
 *  Language and appearance belong where they are reachable from any screen,
 *  not only from inside the profile, so this is what the app bars render.
 *
 *  `round` matches the seller workspace header on web, where the pair renders
 *  as 34px transparent circles rather than the filled squares the buyer app
 *  bars use. */
export function PreferenceToggleButtons({ round }: { round?: boolean } = {}) {
  const { lang, toggleLang, t } = useI18n()
  const { theme, toggleTheme, colors } = useTheme()
  const goingDark = theme === 'light'
  const shape = round
    ? { borderColor: colors.border, backgroundColor: 'transparent', width: 34, minWidth: 34, height: 34, borderRadius: 999 }
    : { borderColor: colors.border, backgroundColor: colors.white }

  return (
    <View style={compact.row}>
      <Pressable
        onPress={toggleLang}
        hitSlop={8}
        style={[compact.button, shape]}
        accessibilityRole="button"
        accessibilityLabel={lang === 'fr' ? t('prefs.switchToEnglish') : t('prefs.switchToFrench')}
      >
        <Text style={[compact.langText, { color: colors.green }]}>{lang === 'fr' ? 'FR' : 'EN'}</Text>
      </Pressable>

      <Pressable
        onPress={toggleTheme}
        hitSlop={8}
        style={[compact.button, shape]}
        accessibilityRole="button"
        accessibilityLabel={goingDark ? t('prefs.switchToDark') : t('prefs.switchToLight')}
      >
        <Ionicons name={goingDark ? 'moon-outline' : 'sunny-outline'} size={18} color={colors.green} />
      </Pressable>
    </View>
  )
}

const compact = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 36pt keeps the pair inside a standard header without crowding the title,
  // and hitSlop above restores a comfortable touch target.
  button: { minWidth: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  langText: { fontWeight: '900', fontSize: 13 },
})

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.md },
  label: { flex: 1, fontWeight: '700', fontSize: 15 },
  value: { fontWeight: '900', fontSize: 14 },
  divider: { height: 1, marginHorizontal: spacing.md },
})
