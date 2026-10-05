import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { authApi, type VerificationChannel, type WhatsAppChallenge } from '../api'
import { ApiError } from '../api/client'
import { Button } from './ui'
import { useCooldown } from './AuthFormParts'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, radius, type Colors } from '../theme'

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
              <Ionicons name={c === 'email' ? 'mail-outline' : 'logo-whatsapp'} size={18} color={selected ? colors.onGreen : colors.muted} />
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
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)
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
        <View style={styles.badge}><Ionicons name="phone-portrait-outline" size={26} color={colors.onGreen} /></View>
        <Text style={styles.headTitle}>{t('auth.whatsapp.codeTitle')}</Text>
        <Text style={styles.muted}>{t('auth.whatsapp.codeSentTo', { phone: current.phone_masked })}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Six digit boxes driven by one hidden input (keeps SMS autofill). */}
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes} accessible={false}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === code.length || (i === 5 && code.length === 6))
          return (
            <View key={i} style={[styles.box, !!code[i] && styles.boxFilled, active && styles.boxActive]}>
              <Text style={styles.boxText}>{code[i] ?? ''}</Text>
            </View>
          )
        })}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          caretHidden
          returnKeyType="go"
          onSubmitEditing={verify}
          accessibilityLabel={t('auth.whatsapp.codeLabel')}
          testID="whatsapp-otp"
        />
      </Pressable>

      <Text style={[styles.muted, styles.center]}>
        {t('auth.whatsapp.notReceived')}{' '}
        {cooldown.left > 0 ? (
          <Text style={styles.resendOff}>{t('auth.whatsapp.resendIn', { seconds: cooldown.left })}</Text>
        ) : (
          <Text style={styles.link} accessibilityRole="link" onPress={() => void resend()}>{t('auth.whatsapp.resend')}</Text>
        )}
      </Text>
      {resent ? <Text style={[styles.success, styles.center]}>✓ {t('auth.whatsapp.resent')}</Text> : null}
      <Text style={[styles.muted, styles.center, styles.small]}>{t('auth.whatsapp.codeValidity', { minutes: Math.round(current.expires_in / 60) })}</Text>

      <View style={styles.spacer} />
      <Button title={t('auth.whatsapp.verify')} loading={busy} disabled={code.length !== 6} onPress={verify} />
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>{t('auth.whatsapp.changeNumber')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  channel: { gap: 8 },
  channelLabel: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  switch: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.surface2, borderRadius: 14 },
  option: { flex: 1, minHeight: 42, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  optionSelected: { backgroundColor: colors.green },
  optionText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  optionTextSelected: { color: colors.onGreen },
  form: { flexGrow: 1, gap: 14 },
  // Reference 14: blue rounded tile, bold title, muted line.
  head: { gap: 8, marginBottom: 4 },
  badge: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headTitle: { color: colors.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 24, letterSpacing: -0.3 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  success: { color: colors.success, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm, fontSize: 14 },
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginVertical: 6 },
  box: { flex: 1, maxWidth: 52, aspectRatio: 0.86, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: colors.borderControl },
  boxActive: { borderColor: colors.green, borderWidth: 2 },
  boxText: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.011, color: 'transparent' },
  center: { textAlign: 'center' },
  small: { fontSize: 12 },
  link: { color: colors.green, fontWeight: '700' },
  resendOff: { color: colors.muted, fontWeight: '600' },
  spacer: { height: 8 },
  back: { alignSelf: 'center', paddingVertical: 6 },
  backText: { color: colors.green, fontWeight: '700', fontSize: 14 },
})
