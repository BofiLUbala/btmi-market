import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import type { Colors } from '../theme'

/**
 * "Se souvenir de moi": keeps only the e-mail of the last sign-in, per space,
 * so the next login is pre-filled. The password is never stored by the app —
 * the OS autofill / password manager offers it (autoComplete="current-password").
 */
export type LoginSpace = 'buyer' | 'admin'
const key = (space: LoginSpace) => `btmi.rememberedEmail.${space}`

export function useRememberedEmail(space: LoginSpace) {
  const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(key(space)).then((saved) => {
      if (!alive || !saved) return
      // Never overwrite something the user already started typing.
      setEmail((current) => current || saved)
      setRemember(true)
      setPrefilled(true)
    }).catch(() => {})
    return () => { alive = false }
  }, [space])
  return {
    email,
    setEmail,
    remember,
    setRemember,
    /** True once the form was pre-filled: focus the password instead. */
    prefilled,
    persist: (value: string) => {
      const clean = value.trim().toLowerCase()
      const op = remember && clean ? AsyncStorage.setItem(key(space), clean) : AsyncStorage.removeItem(key(space))
      return op.catch(() => {})
    },
  }
}

export function RememberMe({ checked, onChange, dark }: { checked: boolean; onChange: (value: boolean) => void; dark?: boolean }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark])
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={6}
      style={styles.remember}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Ionicons name="checkmark" size={15} color={dark ? '#fff' : colors.onGreen} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rememberText}>{t('auth.rememberMe')}</Text>
        <Text style={styles.rememberHint}>{t('auth.rememberMeHint')}</Text>
      </View>
    </Pressable>
  )
}

/** Seconds left before an action may run again; `start()` arms it. */
export function useCooldown(seconds: number, startRunning = false) {
  const [left, setLeft] = useState(startRunning ? seconds : 0)
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return { left, start: () => setLeft(seconds) }
}

/**
 * "Renvoyer l'e-mail" with a 60 s cooldown, right where the e-mail was sent
 * (account creation, forgotten password) — no retyping the address.
 */
export function ResendEmailButton({ onResend, label, initialCooldown = true }: {
  onResend: () => Promise<unknown>
  label: string
  initialCooldown?: boolean
}) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const cooldown = useCooldown(60, initialCooldown)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function resend() {
    setState('sending')
    try {
      await onResend()
      setState('sent')
      cooldown.start()
    } catch {
      setState('error')
    }
  }

  return (
    <View style={styles.resend}>
      <Text style={styles.resendHint}>{t('auth.resendNotReceived')}</Text>
      <Button
        variant="outline"
        title={cooldown.left > 0 ? t('auth.resendIn', { seconds: cooldown.left }) : label}
        loading={state === 'sending'}
        disabled={cooldown.left > 0}
        onPress={() => void resend()}
      />
      {state === 'sent' ? <Text style={styles.ok}>✓ {t('auth.resendSentAgain')}</Text> : null}
      {state === 'error' ? <Text style={styles.err}>{t('auth.register.resendFailed')}</Text> : null}
    </View>
  )
}

const makeStyles = (colors: Colors, dark?: boolean) => StyleSheet.create({
  remember: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: dark ? '#475569' : colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: dark ? '#2563eb' : colors.ink, borderColor: dark ? '#2563eb' : colors.ink },
  rememberText: { color: dark ? '#e2e8f0' : colors.ink, fontSize: 15, fontWeight: '500' },
  rememberHint: { color: dark ? '#64748b' : colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  resend: { gap: 8 },
  resendHint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  ok: { color: colors.success, fontWeight: '700' },
  err: { color: colors.danger, fontWeight: '600' },
})
