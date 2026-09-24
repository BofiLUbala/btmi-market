import { useEffect, useRef } from 'react'
import { API_BASE, api, tokenStore } from '../api/client'
import { adminApi, adminTokenStore } from '../api/admin'

/**
 * Real-time order changes pushed by the server (SSE). The server says only
 * which order changed; pages reload through their usual endpoints, so an event
 * never shows data its receiver could not already read. Pages keep their own
 * slow polling as a fallback for when the stream is down.
 */
export interface OrderEvent {
  kind: 'order' | 'resync'
  order_id?: string
  order_number?: string
  status?: string
  delivery_status?: string
}

type Audience = 'user' | 'admin'
type Listener = (event: OrderEvent) => void

interface Channel {
  listeners: Set<Listener>
  abort?: AbortController
}

const channels: Record<Audience, Channel> = {
  user: { listeners: new Set() },
  admin: { listeners: new Set() },
}

const SOURCES: Record<Audience, { path: string; token: () => string | null; refresh: () => Promise<unknown> }> = {
  user: { path: '/events/stream', token: tokenStore.getAccess, refresh: () => api('/auth/me') },
  admin: { path: '/admin/commerce/events/stream', token: adminTokenStore.getAccess, refresh: () => adminApi('/admin/auth/me') },
}

function emit(audience: Audience, event: OrderEvent) {
  for (const listener of channels[audience].listeners) listener(event)
}

async function run(audience: Audience, abort: AbortController) {
  const source = SOURCES[audience]
  let delay = 1000
  while (!abort.signal.aborted) {
    const token = source.token()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}${source.path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: abort.signal,
      })
      if (res.status === 401) {
        // An ordinary authenticated call refreshes the access token.
        await source.refresh().catch(() => undefined)
      } else if (res.ok && res.body) {
        delay = 1000
        // Anything missed while disconnected is caught up by one reload.
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
            const data = block.split('\n').find((line) => line.startsWith('data: '))
            if (!data || block.startsWith(':') || block.includes('event: ready')) continue
            try { emit(audience, JSON.parse(data.slice(6)) as OrderEvent) } catch { /* ignore a malformed frame */ }
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

function subscribe(audience: Audience, listener: Listener): () => void {
  const channel = channels[audience]
  channel.listeners.add(listener)
  if (!channel.abort) {
    channel.abort = new AbortController()
    void run(audience, channel.abort)
  }
  return () => {
    channel.listeners.delete(listener)
    if (channel.listeners.size === 0) {
      channel.abort?.abort()
      channel.abort = undefined
    }
  }
}

/**
 * Calls onChange as soon as an order this viewer can see changes. With orderId
 * it fires only for that order (and for a resync after a reconnection).
 */
export function useOrderEvents(onChange: (event: OrderEvent) => void, options: { orderId?: string; audience?: Audience } = {}) {
  const callback = useRef(onChange)
  callback.current = onChange
  const { orderId, audience = 'user' } = options
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribe(audience, (event) => {
      if (orderId && event.kind === 'order' && event.order_id !== orderId) return
      // One transaction can touch several rows; reload once for the burst.
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(event), 150)
    })
    return () => { clearTimeout(timer); unsubscribe() }
  }, [orderId, audience])
}
