import { useEffect, useState } from 'react'
import { API_BASE } from '@/api/client'

/** What the Control Center publishes for every public client. */
export type PlatformState = {
  maintenance: { status: 'OFF' | 'PARTIAL' | 'FULL'; message: string; affected_clients?: string[] }
  maintenance_active: boolean
  announcements: { id: string; title: string; message: string; audience: string }[]
  feature_flags: Record<string, boolean>
  min_supported_android_version?: string
}

const POLL_MS = 60_000
let cached: PlatformState | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<(s: PlatformState | null) => void>()

async function refresh() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/config/platform-state`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      cached = (body?.data ?? body) as PlatformState
      listeners.forEach((fn) => fn(cached))
    } catch {
      // Offline or API down: keep the last known state.
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Shared, polled platform state. One request serves every subscriber. */
export function usePlatformState(): PlatformState | null {
  const [state, setState] = useState<PlatformState | null>(cached)
  useEffect(() => {
    listeners.add(setState)
    void refresh()
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      listeners.delete(setState)
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return state
}

/** A flag the Control Center switched off. A missing flag counts as on. */
export function useFeatureEnabled(key: string): boolean {
  const state = usePlatformState()
  return state?.feature_flags?.[key] !== false
}

const DISMISSED_KEY = 'tbk.dismissedAnnouncements'
function readDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') } catch { return [] }
}

/** Maintenance notice and active announcements for the given audience. */
export function PlatformBanner({ audience }: { audience: 'BUYERS' | 'SELLERS' }) {
  const state = usePlatformState()
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)
  if (!state) return null

  const announcements = (state.announcements ?? []).filter(
    (a) => (a.audience === 'ALL' || a.audience === audience) && !dismissed.includes(a.id)
  )
  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)) } catch { /* per-session only */ }
  }

  return (
    <div className="platform-banners">
      {state.maintenance_active && (
        <div role="alert" className={`platform-banner platform-banner-${state.maintenance.status === 'FULL' ? 'danger' : 'warning'}`}>
          <strong>{state.maintenance.status === 'FULL' ? 'Maintenance en cours' : 'Maintenance partielle'}</strong>
          <span>
            {state.maintenance.message ||
              (state.maintenance.status === 'FULL'
                ? 'La plateforme est momentanément indisponible.'
                : 'La consultation reste possible ; les commandes et modifications sont suspendues.')}
          </span>
        </div>
      )}
      {announcements.map((a) => (
        <div key={a.id} role="status" className="platform-banner platform-banner-info">
          <strong>{a.title}</strong>
          <span>{a.message}</span>
          <button type="button" aria-label="Masquer l’annonce" onClick={() => dismiss(a.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
