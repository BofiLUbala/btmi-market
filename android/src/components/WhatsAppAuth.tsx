import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { authApi, type VerificationChannel, type WhatsAppChallenge } from '../api'
import { ApiError } from '../api/client'
import { Button } from './ui'
import { useCooldown } from './AuthFormParts'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import type { Colors } from '../theme'

type T = ReturnType<typeof useI18n>['t']

let statusPromise: Promise<boolean> | null = null

/** Whether the server offers WhatsApp codes (an OpenWA gateway is configured). */
export function useWhatsAppEnabled() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let alive = true
    statusPromise ??= authApi.whatsappStatus().then((r) => !!r?.enabled).catch(() => {
      statusPromise = null
      return false
    })
    void statusPromise.then((v) => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])
  return enabled
}

/** "E-mail | WhatsApp" switch above the sign-in and sign-up forms. */
export function ChannelSwitch({ value, onChange, label }: { value: VerificationChannel; onChange: (v: VerificationChannel) => void; label?: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.channel}>
      {label ? <Text style={styles.channelLabel}>{label}</Text> : null}
      <View style={styles.switch} accessibilityRole="radiogroup">
        {(['email', 'whatsapp'] as const).map((c) => {
          const selected = value === c
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              testID={`channel-${c}`}
            >
              <Ionicons name={c === 'email' ? 'mail-outline' : 'logo-whatsapp'} size={18} color={selected ? colors.white : colors.muted} />
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{c === 'email' ? t('auth.email') : 'WhatsApp'}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function whatsappErrorMessage(err: unknown, t: T): string {
  if (!(err instanceof ApiError)) return t('auth.loginFailed')
  switch (err.code) {
    case 'INVALID_CREDENTIALS': return t('auth.whatsapp.invalidCredentials')
    case 'OTP_INCORRECT': return t('auth.whatsapp.codeIncorrect')
    case 'OTP_EXPIRED':
    case 'OTP_INVALID': return t('auth.whatsapp.codeExpired')
    case 'OTP_ALREADY_USED': return t('auth.whatsapp.codeUsed')
    case 'OTP_TOO_MANY_ATTEMPTS': return t('auth.whatsapp.tooManyAttempts')
    case 'OTP_RESEND_TOO_SOON':
    case 'RATE_LIMITED': return t('auth.whatsapp.rateLimited')
    case 'WHATSAPP_UNAVAILABLE': return t('auth.whatsapp.unavailable')
    case 'WHATSAPP_DELIVERY_FAILED': return t('auth.whatsapp.deliveryFailed')
    case 'ACCOUNT_SUSPENDED': return t('auth.whatsapp.suspended')
    case 'NETWORK_ERROR': return t('errors.network')
  }
  return err.message
}

/** The challenge carried by a 502 WHATSAPP_DELIVERY_FAILED (the code can be resent). */
export function challengeFromError(err: unknown): WhatsAppChallenge | null {
  if (err instanceof ApiError && err.code === 'WHATSAPP_DELIVERY_FAILED' && typeof err.data?.challenge_id === 'string') {
    return err.data as unknown as WhatsAppChallenge
  }
  return null
}

/** Six-digit code entry with resend; `onVerify` opens the session (throws on a bad code). */
export function WhatsAppCodeForm({ challenge, onVerify, onBack, initialError = '' }: {
  challenge: WhatsAppChallenge
  onVerify: (challengeId: string, code: string) => Promise<unknown>
  onBack?: () => void
  initialError?: string
}) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [current, setCurrent] = useState(challenge)
  const [code, setCode] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const cooldown = useCooldown(45, !initialError)

  useEffect(() => setCurrent(challenge), [challenge])

  async function verify() {
    if (busy || code.length !== 6) return
    setError(''); setBusy(true)
    try { await onVerify(current.challenge_id, code) }
    catch (err) { setError(whatsappErrorMessage(err, t)) }
    finally { setBusy(false) }
  }

  async function resend() {
    setError(''); setResent(false)
    try {
      setCurrent(await authApi.whatsappResend(current.challenge_id))
      setCode(''); setResent(true); cooldown.start()
    } catch (err) {
      const pending = challengeFromError(err)
      if (pending) setCurrent(pending)
      setError(whatsappErrorMessage(err, t))
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <View style={styles.badge}><Ionicons name="logo-whatsapp" size={22} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle}>{t('auth.whatsapp.codeTitle')}</Text>
          <Text style={styles.muted}>{t('auth.whatsapp.codeSentTo', { phone: current.phone_masked })}</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.channelLabel}>{t('auth.whatsapp.codeLabel')}</Text>
      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        placeholder="123456"
        placeholderTextColor={colors.faint}
        returnKeyType="go"
        onSubmitEditing={verify}
        testID="whatsapp-otp"
      />
      <Text style={styles.muted}>{t('auth.whatsapp.codeValidity', { minutes: Math.round(current.expires_in / 60) })}</Text>
      <Button title={t('auth.whatsapp.verify')} loading={busy} disabled={code.length !== 6} onPress={verify} />
      <Text style={styles.muted}>{t('auth.whatsapp.notReceived')}</Text>
      <Button
        title={cooldown.left > 0 ? t('auth.whatsapp.resendIn', { seconds: cooldown.left }) : t('auth.whatsapp.resend')}
        variant="outline"
        disabled={cooldown.left > 0}
        onPress={() => void resend()}
      />
      {resent ? <Text style={styles.success}>✓ {t('auth.whatsapp.resent')}</Text> : null}
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>← {t('auth.whatsapp.back')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  channel: { gap: 6 },
  channelLabel: { color: colors.ink, fontWeight: '500', fontSize: 14 },
  switch: { flexDirection: 'row', gap: 4, padding: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  option: { flex: 1, minHeight: 42, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  optionSelected: { backgroundColor: colors.green },
  optionText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  optionTextSelected: { color: colors.white },
  form: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  success: { color: colors.green, fontSize: 14 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
  codeInput: { minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, color: colors.ink, fontSize: 26, letterSpacing: 10, textAlign: 'center' },
  back: { alignSelf: 'center', paddingVertical: 4 },
  backText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
})
