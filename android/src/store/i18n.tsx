import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fr } from '../locales/fr'
import { en } from '../locales/en'

export type Lang = 'fr' | 'en'

const STORAGE_KEY = 'btmi.lang'

/** French is the source of truth: every key must exist there. English may lag
 *  behind and falls back to the French string rather than rendering a raw key.
 *  Values are widened to `string` — otherwise each entry's type would be its
 *  own French sentence and no translation could be assigned to it. */
export type TranslationKey = keyof typeof fr
export type Dictionary = Record<TranslationKey, string>

const DICTIONARIES: Record<Lang, Partial<Dictionary>> = { fr, en }

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nState | null>(null)

/** Reads the device locale from Intl (built into Hermes), which avoids pulling
 *  in expo-localization just for this. The marketplace serves the DRC, so
 *  French is the default for any device not explicitly set to English. */
function deviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return locale?.toLowerCase().startsWith('en') ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

/** Replaces {name} placeholders. A missing var is left visible on purpose so a
 *  forgotten interpolation shows up in review instead of printing "undefined". */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  )
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return
        if (stored === 'fr' || stored === 'en') setLangState(stored)
      })
      .catch(() => {
        /* unreadable storage: stay on the device language */
      })
    return () => {
      active = false
    }
  }, [])

  const persist = useCallback((next: Lang) => {
    setLangState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* not fatal: the language still applies for this session */
    })
  }, [])

  const toggleLang = useCallback(() => {
    setLangState((current) => {
      const next = current === 'fr' ? 'en' : 'fr'
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const value = DICTIONARIES[lang][key] ?? fr[key] ?? (key as string)
      return interpolate(value as string, vars)
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang: persist, toggleLang, t }), [lang, persist, toggleLang, t])

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
