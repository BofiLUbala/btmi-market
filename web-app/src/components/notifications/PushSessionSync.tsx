import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useAdminAuth } from '@/store/adminAuth'
import { pushOwner, registerServiceWorker, releasePush, syncPush } from '@/lib/push'
import { tokenStore } from '@/api/client'
import { adminTokenStore } from '@/api/admin'

/** Fired on window when a push arrives while a tab is open, so badges refresh. */
export const PUSH_RECEIVED_EVENT = 'tbk:push-received'

/**
 * Keeps this browser's push subscription attached to the signed-in account:
 * re-attached at each session start, released when that account signs out
 * (or when the app starts with no session for it). Also follows the service
 * worker's requests to open a screen in this tab.
 */
export default function PushSessionSync() {
  const navigate = useNavigate()
  const { user, loading: userLoading } = useAuth()
  const { admin, loading: adminLoading } = useAdminAuth()
  const lastUser = useRef<string | null | undefined>(undefined)
  const lastAdmin = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    void registerServiceWorker()
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'tbk:navigate' && typeof data.url === 'string' && data.url.startsWith('/')) {
        navigate(data.url)
      } else if (data?.type === 'tbk:push') {
        window.dispatchEvent(new Event(PUSH_RECEIVED_EVENT))
      } else if (data?.type === 'tbk:resubscribe') {
        const owner = pushOwner()
        if (owner) void syncPush(owner)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    if (userLoading) return
    const id = user?.id ?? null
    if (lastUser.current === id) return
    lastUser.current = id
    // Admin pages never load the user session, so "no user" alone does not
    // mean signed out: only a session whose tokens are gone is released.
    if (id) void syncPush('user')
    else if (!tokenStore.getRefresh()) void releasePush('user')
  }, [user?.id, userLoading])

  useEffect(() => {
    if (adminLoading) return
    const id = admin?.id ?? null
    if (lastAdmin.current === id) return
    lastAdmin.current = id
    if (id) void syncPush('admin')
    else if (!adminTokenStore.getRefresh()) void releasePush('admin')
  }, [admin?.id, adminLoading])

  return null
}
