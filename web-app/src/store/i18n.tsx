import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fr } from '@/locales/fr'
import { en } from '@/locales/en'

export type Lang = 'fr' | 'en'

const STORAGE_KEY = 'btmi.lang'

/** French is the source of truth: every key must exist there. English may lag
 *  behind during a migration, and falls back to the French string rather than
 *  rendering a raw key in the UI.
 *
 *  Keys come from `fr` (which is `as const`, so they are literal), but values
 *  are widened to `string` — otherwise each entry's type would be its own
 *  French sentence and no translation could ever be assigned to it. */
export type TranslationKey = keyof typeof fr | keyof typeof en
export type Dictionary = Record<TranslationKey, string>

const DICTIONARIES: Record<Lang, Record<string, string>> = { fr: fr as Record<string, string>, en: en as Record<string, string> }

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: keyof Dictionary | (string & {}), vars?: Record<string, string | number | undefined | null>) => string
}

const I18nContext = createContext<I18nState | null>(null)

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'fr' || stored === 'en') return stored
  } catch {
    /* storage disabled: fall through to the browser language */
  }
  // The marketplace serves the DRC, so French is the default for anyone whose
  // browser is not explicitly set to English.
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

/** Replaces {name} placeholders. Missing vars are left visible on purpose so a
 *  forgotten interpolation shows up in review instead of rendering "undefined". */
function interpolate(template: string, vars?: Record<string, string | number | undefined | null>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars && vars[key] != null ? String(vars[key]) : match
  )
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* not fatal: the language still applies for this session */
    }
  }, [lang])

  const t = useCallback(
    (key: keyof Dictionary | (string & {}), vars?: Record<string, string | number | undefined | null>) => {
      const dict = DICTIONARIES[lang]
      const value = (dict as Record<string, string>)[key] ?? (fr as Record<string, string>)[key] ?? (key as string)
      return interpolate(value as string, vars)
    },
    [lang]
  )

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'fr' ? 'en' : 'fr')), [])

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useI18n().t
}
