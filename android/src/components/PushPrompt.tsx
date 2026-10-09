import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { enablePush, pushState } from '../lib/push'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { radius, shadow, spacing, type Colors } from '../theme'
import { Button } from './ui'

/**
 * Accounts already asked since this launch. Deliberately in memory and not on
 * disk: the ask comes back on the next sign-in, for as long as notifications
 * are off.
 */
const askedThisSession = new Set<string>()

/**
 * Every time an account signs in on this device (phone or browser), TBK asks
 * to turn on push notifications. "Turn on" shows the system/browser permission
 * (a click is required for it on the web) and attaches this device. There is
 * no "Not now": closing the window only puts the ask off until the next
 * sign-in, so an account that never turns them on is asked every time.
 *
 * A browser that blocked notifications for good reports "denied", and is not
 * asked again: the only way back is the browser's own site settings.
 */
export function PushPrompt({ userId }: { userId: string }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  // The browser or its push service did not answer: say so instead of
  // closing as if it had worked.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (askedThisSession.has(userId)) return
      const state = await pushState('user').catch(() => 'unavailable' as const)
      if (cancelled) return
      if (state === 'off') setVisible(true)
      else askedThisSession.add(userId)
    })()
    return () => { cancelled = true }
  }, [userId])

  const close = () => {
    askedThisSession.add(userId)
    setVisible(false)
  }

  const accept = async () => {
    setBusy(true)
    try {
      const state = await enablePush('user')
      if (state === 'denied') { setBlocked(true); return }
      if (state === 'unavailable') { setFailed(true); return }
      close()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          {/* No "Not now": only this corner closes the window, and the ask
              comes back on the next sign-in. */}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10} style={s.close} disabled={busy}>
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
          <View style={s.icon}><Ionicons name="notifications" size={28} color={c.onGreen} /></View>
          <Text style={s.title}>{t('pushPrompt.title')}</Text>
          <Text style={s.body}>{blocked ? t('pushPrompt.denied') : failed ? t('pushPrompt.unavailable') : t('pushPrompt.body')}</Text>
          {blocked
            ? <Button title="OK" onPress={close} />
            : <Button title={t(failed ? 'pushPrompt.retry' : 'pushPrompt.accept')} onPress={() => void accept()} loading={busy} />}
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6, 12, 28, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 400, backgroundColor: c.white, borderRadius: radius.lg, padding: spacing.lg, gap: 12, alignItems: 'stretch', ...shadow.raised },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { color: c.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: c.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginBottom: 4 },
  close: { position: 'absolute', top: 8, right: 8, padding: 6, zIndex: 1 },
})
