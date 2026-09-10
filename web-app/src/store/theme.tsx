import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'btmi.theme'

interface ThemeState {
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeState | null>(null)

/**
 * Resolves the theme to apply on first paint: an explicit past choice wins,
 * otherwise we follow the operating system so a user who runs their phone in
 * dark mode does not get a white flash on their first visit.
 */
function readInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored as ThemeMode
  } catch {
    /* private mode / storage disabled: fall through to the system preference */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme)

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
      return 'light'
    }
    return theme
  })

  useEffect(() => {
    const active = theme === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    setResolvedTheme(active)
    document.documentElement.setAttribute('data-theme', active)
    
    // Also set classes for Tailwind or other class-based utilities if any exist
    if (active === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* not fatal: the theme still applies for this session */
    }
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => {
      if (theme === 'system') {
        const active = event.matches ? 'dark' : 'light'
        setResolvedTheme(active)
        document.documentElement.setAttribute('data-theme', active)
        if (active === 'dark') {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.add('light')
          document.documentElement.classList.remove('dark')
        }
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), [])
  const toggleTheme = useCallback(() => setThemeState((t) => {
    if (t === 'light') return 'dark'
    if (t === 'dark') return 'system'
    return 'light'
  }), [])

  const value = useMemo(() => ({ theme, toggleTheme, setTheme, resolvedTheme }), [theme, toggleTheme, setTheme, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
