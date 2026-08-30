import { useI18n } from '@/store/i18n'
import { useTheme } from '@/store/theme'
import { MoonIcon, SunIcon } from './Icons'

/** Light/dark switch. Icon shows the theme you would switch *to*, which is the
 *  convention users already know from other apps. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const goingDark = theme === 'light'

  return (
    <button
      type="button"
      className={`pref-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={goingDark ? t('prefs.switchToDark') : t('prefs.switchToLight')}
      title={goingDark ? t('prefs.switchToDark') : t('prefs.switchToLight')}
    >
      {goingDark ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

/** FR/EN switch. The label shows the language you would switch *to*, so the
 *  button reads as an action rather than a status. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang, t } = useI18n()
  const target = lang === 'fr' ? 'EN' : 'FR'

  return (
    <button
      type="button"
      className={`pref-toggle pref-toggle-lang ${className}`}
      onClick={toggleLang}
      aria-label={lang === 'fr' ? t('prefs.switchToEnglish') : t('prefs.switchToFrench')}
      title={lang === 'fr' ? t('prefs.switchToEnglish') : t('prefs.switchToFrench')}
    >
      {target}
    </button>
  )
}

export function PreferenceToggles({ className = '' }: { className?: string }) {
  return (
    <span className={`pref-toggles ${className}`}>
      <LangToggle />
      <ThemeToggle />
    </span>
  )
}
