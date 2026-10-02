import { useCallback, useEffect, useRef, useState } from 'react'
import { buyerApi } from '@/api/buyer'
import { adminCommerceApi } from '@/api/admin'
import { courierApi } from '@/api/courier'
import type { CourierLocation } from '@/api/types'
import { useOrderEvents } from './orderEvents'
import { LOCATION_POLL_MS } from './liveLocation'

/**
 * The courier's latest position for one order. A `location` SSE event (or a
 * change of the order itself) refetches the position only, never the page.
 * While the page is visible it also polls every 10 s, in case the stream is
 * down; hidden tabs neither poll nor render.
 */
export function useCourierLocation(orderId: string, audience: 'user' | 'admin' | 'courier', enabled: boolean) {
  const [data, setData] = useState<CourierLocation | null>(null)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)

  const refetch = useCallback(async () => {
    if (!enabled || !orderId) return
    const mine = ++seq.current
    try {
      const next = audience === 'admin'
        ? await adminCommerceApi.getCourierLocation(orderId)
        : audience === 'courier'
          ? await courierApi.live(orderId)
          : await buyerApi.courierLocation(orderId)
      // A slower, older response must not overwrite a newer one.
      if (mine !== seq.current) return
      setData(next)
      setFetchedAt(Date.now())
      setFailed(false)
    } catch {
      if (mine === seq.current) setFailed(true)
    }
  }, [orderId, audience, enabled])

  useEffect(() => { void refetch() }, [refetch])

  // The courier's own stream carries no location events: the poll covers them.
  useOrderEvents(() => void refetch(), { orderId, audience: audience === 'admin' ? 'admin' : 'user', kinds: ['location', 'order', 'resync'] })

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => { stop(); timer = setInterval(() => void refetch(), LOCATION_POLL_MS) }
    const stop = () => { if (timer) clearInterval(timer); timer = undefined }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { void refetch(); start() } else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [enabled, refetch])

  return { data, fetchedAt, failed, refetch }
}
