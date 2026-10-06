import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { enablePush, pushState } from '../lib/push'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { radius, shadow, spacing, type Colors } from '../theme'
import { Button } from './ui'

const promptedKey = (userId: string) => `btmi.push.prompted.${userId}`

/**
 * The first time an account signs in on this device (phone or browser), TBK
 * asks whether to turn on push notifications. "Turn on" then shows the
 * system/browser permission (a click is required for it on the web) and
 * attaches this device; "Not now" leaves it to the notification settings.
 * Asked once per account and device.
 */
export function PushPrompt({ userId }: { userId: string }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const asked = await AsyncStorage.getItem(promptedKey(userId)).catch(() => '1')
      if (asked || cancelled) return
      const state = await pushState('user').catch(() => 'unavailable' as const)
      if (cancelled) return
      if (state === 'off') setVisible(true)
      else if (state === 'on') void AsyncStorage.setItem(promptedKey(userId), '1').catch(() => undefined)
    })()
    return () => { cancelled = true }
  }, [userId])

  const close = () => {
    void AsyncStorage.setItem(promptedKey(userId), '1').catch(() => undefined)
    setVisible(false)
  }

  const accept = async () => {
    setBusy(true)
    try {
      const state = await enablePush('user')
      if (state === 'denied') { setBlocked(true); return }
      close()
    } catch {
      close()
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          <View style={s.icon}><Ionicons name="notifications" size={28} color={c.onGreen} /></View>
          <Text style={s.title}>{t('pushPrompt.title')}</Text>
          <Text style={s.body}>{blocked ? t('pushPrompt.denied') : t('pushPrompt.body')}</Text>
          {blocked ? <Button title="OK" onPress={close} /> : <>
            <Button title={t('pushPrompt.accept')} onPress={() => void accept()} loading={busy} />
            <Pressable onPress={close} accessibilityRole="button" style={s.later} disabled={busy}>
              <Text style={s.laterText}>{t('pushPrompt.later')}</Text>
            </Pressable>
          </>}
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
  later: { alignItems: 'center', paddingVertical: 10 },
  laterText: { color: c.muted, fontSize: 15, fontWeight: '600' },
})
