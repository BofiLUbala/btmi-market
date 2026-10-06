import { useEffect } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../store/auth'
import { useAdminAuth } from '../store/adminAuth'
import { translate } from '../store/i18n'
import { request } from '../api/client'
import { adminApi } from '../api/admin'
import { onNotificationTap, safeAppPath, syncPush, type PushData } from './push'
import { onWebPushMessage } from './webPush'

/**
 * Opens the screen of a tapped notification.
 *
 * Signed out: the target is kept and the sign-in screen opens; once signed
 * in, the login screen calls takePendingNotificationLink() and goes there.
 * Signed in as someone else: the screen is never opened. The target screen
 * itself still checks the role and access rights.
 */
interface Pending { link: string; uid?: string; kind: 'USER' | 'ADMIN' }
let pending: Pending | null = null

export function takePendingNotificationLink(kind: 'USER' | 'ADMIN', accountId?: string): string | null {
  const p = pending
  if (!p || p.kind !== kind) return null
  pending = null
  if (p.uid && accountId && p.uid !== accountId) return null
  return p.link
}

function waitFor(ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) return resolve()
    const started = Date.now()
    const timer = setInterval(() => {
      if (ready() || Date.now() - started > 15000) {
        clearInterval(timer)
        resolve()
      }
    }, 100)
  })
}

async function open(data: PushData) {
  const isAdmin = data.kind === 'ADMIN'
  const fallback = isAdmin ? '/admin' : data.audience === 'SELLER' ? '/seller/notifications' : data.audience === 'COURIER' ? '/courier' : '/notifications'
  const link = safeAppPath(data.app_link) ?? fallback

  if (isAdmin) {
    if (!useAdminAuth.getState().ready) void useAdminAuth.getState().bootstrap()
    await waitFor(() => useAdminAuth.getState().ready)
  } else {
    await waitFor(() => useAuth.getState().ready)
  }
  const currentId = isAdmin ? useAdminAuth.getState().admin?.id : useAuth.getState().user?.id
  const loginPath = isAdmin ? '/admin/login' : '/auth/login'

  if (!currentId) {
    pending = { link, uid: data.uid, kind: isAdmin ? 'ADMIN' : 'USER' }
    router.push(loginPath as never)
    return
  }
  if (data.uid && data.uid !== currentId) {
    Alert.alert(
      translate('libNotificationRouting.otherAccountTitle'),
      translate('libNotificationRouting.otherAccountBody'),
      [
        { text: translate('common.cancel'), style: 'cancel' },
        {
          text: translate('libNotificationRouting.switchAccount'),
          onPress: async () => {
            if (isAdmin) await useAdminAuth.getState().logout()
            else await useAuth.getState().logout()
            pending = { link, uid: data.uid, kind: isAdmin ? 'ADMIN' : 'USER' }
            router.replace(loginPath as never)
          },
        },
      ]
    )
    return
  }
  if (data.id) {
    const mark = isAdmin
      ? adminApi(`/admin/notifications/${data.id}/read`, { method: 'POST' })
      : request(`/notifications/${data.id}/read`, { method: 'POST' })
    void mark.catch(() => undefined)
  }
  router.push(link as never)
}

/** Mounted once in the root layout. */
export function useNotificationRouting() {
  useEffect(() => onNotificationTap((data) => { void open(data) }), [])
  // Website: a clicked browser notification arrives from the service worker.
  useEffect(() => onWebPushMessage({
    open: (payload) => { void open(payload as PushData) },
    resubscribe: () => { void syncPush('user') },
  }), [])
}
