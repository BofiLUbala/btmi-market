import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Appearance, type ColorSchemeName } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, type Colors } from '../theme'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'btmi.theme'

interface ThemeState {
  theme: ThemeMode
  colors: Colors
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function systemTheme(): ThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start on the OS preference so the very first frame is already right, then
  // correct it once the stored choice comes back from AsyncStorage.
  const [theme, setThemeState] = useState<ThemeMode>(systemTheme)
  const [hasStoredChoice, setHasStoredChoice] = useState(false)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return
        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored)
          setHasStoredChoice(true)
        }
      })
      .catch(() => {
        /* unreadable storage: stay on the OS preference */
      })
    return () => {
      active = false
    }
  }, [])

  // Follow the OS only while the user has never picked a theme themselves.
  useEffect(() => {
    if (hasStoredChoice) return
    const sub = Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      setThemeState(colorScheme === 'dark' ? 'dark' : 'light')
    })
    return () => sub.remove()
  }, [hasStoredChoice])

  const persist = useCallback((next: ThemeMode) => {
    setThemeState(next)
    setHasStoredChoice(true)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* not fatal: the theme still applies for this session */
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      setHasStoredChoice(true)
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      colors: theme === 'dark' ? darkColors : lightColors,
      toggleTheme,
      setTheme: persist,
    }),
    [theme, toggleTheme, persist]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** Shorthand for screens that only need the palette. */
export function useColors(): Colors {
  return useTheme().colors
}
