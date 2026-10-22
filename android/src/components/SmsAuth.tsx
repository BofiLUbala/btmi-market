import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { authApi } from '../api'
import { ApiError } from '../api/client'
import { Button } from './ui'
import { useCooldown } from './AuthFormParts'
import { SmsError, confirmSmsCode, isFirebasePhoneAvailable, resendSmsCode, type SmsChallenge } from '../lib/firebasePhone'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, radius, type Colors } from '../theme'

type T = ReturnType<typeof useI18n>['t']

let statusPromise: Promise<boolean> | null = null

/**
 * Whether this build carries the native Firebase module, asked without ever
 * raising: on a build that lacks it the lookup throws rather than returning
 * false, and this is read during render, where a throw takes the whole screen
 * down instead of merely hiding the SMS choice.
 */
function firebaseReady(): boolean {
  try { return isFirebasePhoneAvailable() } catch { return false }
}

/**
 * Whether this screen may offer the SMS choice: the server has a Firebase
 * project configured *and* this build carries the native module. Either one
 * missing and the option stays hidden rather than failing on the first tap.
 */
export function useSmsEnabled() {
  // Optimistic: a build carrying Firebase offers the choice straight away and
  // gives it up only if the server answers that it has no project configured.
  // Starting at `false` hid the choice behind a round trip, and on a slow link
  // the sign-up page finished loading with no way to pick a number at all —
  // the switch arrived ten seconds later, long after the reader had given up.
  const [enabled, setEnabled] = useState(firebaseReady)
  useEffect(() => {
    if (!firebaseReady()) return
    let alive = true
    statusPromise ??= authApi.smsStatus().then((r) => !!r?.enabled).catch(() => {
      statusPromise = null
      return false
    })
    void statusPromise.then((v) => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])
  return enabled
}

/** Turns a Firebase or API failure into something the reader can act on. */
export function smsErrorMessage(err: unknown, t: T): string {
  const code = err instanceof SmsError ? err.code : err instanceof ApiError ? err.code : ''
  switch (code) {
    case 'INVALID_PHONE': return t('auth.sms.invalidPhone')
    case 'OTP_INCORRECT': return t('auth.whatsapp.codeIncorrect')
    case 'OTP_EXPIRED': return t('auth.whatsapp.codeExpired')
    case 'RATE_LIMITED': return t('auth.whatsapp.rateLimited')
    case 'SMS_QUOTA_EXCEEDED': return t('auth.sms.quotaExceeded')
    case 'SMS_REGION_BLOCKED': return t('auth.sms.regionBlocked')
    case 'SMS_UNAVAILABLE': return t('auth.sms.unavailable')
    case 'FIREBASE_TOKEN_INVALID':
    case 'FIREBASE_PHONE_MISSING': return t('auth.sms.verificationFailed')
    case 'ACCOUNT_SUSPENDED': return t('auth.whatsapp.suspended')
    case 'NETWORK_ERROR': return t('errors.network')
  }
  if (err instanceof ApiError) return err.message
  // Development builds say which Firebase error it was, since the reader is the developer.
  return __DEV__ && err instanceof SmsError ? `${t('auth.sms.sendFailed')} [${err.code}: ${err.message}]` : t('auth.sms.sendFailed')
}

/**
 * Six-digit entry for a code Firebase has just texted.
 *
 * `onToken` receives the Firebase ID token once the code checks out; what to
 * do with it — open a session, or start a password reset — is the caller's
 * business, which is why this component knows nothing about either.
 */
export function SmsCodeForm({ challenge, onToken, onBack, initialError = '' }: {
  challenge: SmsChallenge
  onToken: (idToken: string) => Promise<unknown>
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
    try {
      await onToken(await confirmSmsCode(current, code))
    } catch (err) {
      setError(smsErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(''); setResent(false)
    try {
      setCurrent(await resendSmsCode(current))
      setCode(''); setResent(true); cooldown.start()
    } catch (err) {
      setError(smsErrorMessage(err, t))
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <View style={styles.badge}><Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.onGreen} /></View>
        <Text style={styles.headTitle}>{t('auth.sms.codeTitle')}</Text>
        <Text style={styles.muted}>{t('auth.sms.codeSentTo', { phone: maskPhone(current.phone) })}</Text>
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
          testID="sms-otp"
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

/** +243 ••• ••• •78 — enough to recognise the number, not to read it out. */
function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length < 6) return '••••'
  return '+' + digits.slice(0, 3) + ' ' + '•'.repeat(digits.length - 5) + digits.slice(-2)
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  form: { gap: 14 },
  head: { alignItems: 'center', gap: 6, marginBottom: 4 },
  badge: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  headTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  center: { textAlign: 'center' },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm, fontSize: 14 },
  success: { color: colors.green, fontSize: 13, fontWeight: '600' },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, aspectRatio: 0.78, maxHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: colors.green, backgroundColor: colors.white },
  boxActive: { borderColor: colors.green, borderWidth: 2 },
  boxText: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  link: { color: colors.green, fontWeight: '700' },
  resendOff: { color: colors.faint },
  spacer: { height: 4 },
  back: { alignSelf: 'center', paddingVertical: 8 },
  backText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
})
