import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { fetch as streamingFetch } from 'expo/fetch'
import type { QueryClient } from '@tanstack/react-query'
import { API_URL, get } from '../api/client'
import { tokenStore } from '../api/tokenStore'
import { adminTokenStore } from '../api/adminTokenStore'
import { adminApi } from '../api/admin'

/**
 * Real-time order changes pushed by the server (SSE). An event says only which
 * order changed; screens refetch through their usual endpoints, so nobody sees
 * data they could not already read. The existing polling stays as a fallback.
 */
export interface OrderEvent {
  kind: 'order' | 'resync'
  order_id?: string
  status?: string
  delivery_status?: string
}

type Audience = 'user' | 'admin'
type Listener = (event: OrderEvent) => void

const SOURCES: Record<Audience, { path: string; token: () => Promise<string | null>; refresh: () => Promise<unknown> }> = {
  user: { path: '/events/stream', token: () => tokenStore.getAccess(), refresh: () => get('/auth/me') },
  admin: { path: '/admin/commerce/events/stream', token: () => adminTokenStore.getAccess(), refresh: () => adminApi('/admin/auth/me') },
}

const listeners: Record<Audience, Set<Listener>> = { user: new Set(), admin: new Set() }
const running: Partial<Record<Audience, AbortController>> = {}

function emit(audience: Audience, event: OrderEvent) {
  for (const listener of listeners[audience]) listener(event)
}

async function run(audience: Audience, abort: AbortController) {
  const source = SOURCES[audience]
  let delay = 1000
  while (!abort.signal.aborted) {
    const token = await source.token()
    if (!token) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      continue
    }
    try {
      const res = await streamingFetch(`${API_URL}${source.path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: abort.signal,
      })
      if (res.status === 401) {
        await source.refresh().catch(() => undefined)
      } else if (res.ok && res.body) {
        delay = 1000
        emit(audience, { kind: 'resync' })
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let end: number
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            if (!block.includes('event: order')) continue
            const data = block.split('\n').find((line) => line.startsWith('data: '))
            if (!data) continue
            try { emit(audience, JSON.parse(data.slice(6)) as OrderEvent) } catch { /* malformed frame */ }
          }
        }
      }
    } catch {
      if (abort.signal.aborted) return
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 2, 30_000)
  }
}

function start(audience: Audience) {
  if (running[audience] || AppState.currentState !== 'active') return
  const abort = new AbortController()
  running[audience] = abort
  void run(audience, abort).finally(() => { if (running[audience] === abort) delete running[audience] })
}

function stop(audience: Audience) {
  running[audience]?.abort()
  delete running[audience]
}

// A backgrounded app keeps no connection open; coming back reconnects and resyncs.
AppState.addEventListener('change', (state) => {
  for (const audience of ['user', 'admin'] as Audience[]) {
    if (state === 'active' && listeners[audience].size) start(audience)
    else if (state !== 'active') stop(audience)
  }
})

export function subscribeOrderEvents(audience: Audience, listener: Listener): () => void {
  listeners[audience].add(listener)
  start(audience)
  return () => {
    listeners[audience].delete(listener)
    if (!listeners[audience].size) stop(audience)
  }
}

/** Screens that load outside react-query (admin) reload on each relevant event. */
export function useOrderEvents(onChange: Listener, options: { orderId?: string; audience?: Audience } = {}) {
  const callback = useRef(onChange)
  callback.current = onChange
  const { orderId, audience = 'user' } = options
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeOrderEvents(audience, (event) => {
      if (orderId && event.kind === 'order' && event.order_id !== orderId) return
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(event), 150)
    })
    return () => { clearTimeout(timer); unsubscribe() }
  }, [orderId, audience])
}

/**
 * For the signed-in user (buyer, seller, courier): every visible react-query
 * screen refetches as soon as one of their orders changes.
 */
export function useLiveOrderQueries(queryClient: QueryClient, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeOrderEvents('user', () => {
      clearTimeout(timer)
      timer = setTimeout(() => void queryClient.invalidateQueries({ refetchType: 'active' }), 150)
    })
    return () => { clearTimeout(timer); unsubscribe() }
  }, [queryClient, enabled])
}
