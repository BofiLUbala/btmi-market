import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi, type VerificationChannel } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { ResendEmailButton } from '../../src/components/AuthFormParts'
import { AuthWideShell, useAuthWide } from '../../src/components/AuthWideShell'
import { ChannelSwitch } from '../../src/components/WhatsAppAuth'
import { PhoneInput } from '../../src/components/PhoneInput'
import { SmsCodeForm, smsErrorMessage, useSmsEnabled } from '../../src/components/SmsAuth'
import { sendSmsCode, type SmsChallenge } from '../../src/lib/firebasePhone'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

/** Same response time whether or not the account exists (no enumeration by timing). */
async function requestReset(identifier: string) {
  const startedAt = Date.now()
  try { return await authApi.forgotPassword(identifier) }
  finally {
    const remaining = 1200 - (Date.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

export default function ForgotPassword() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  // Pre-filled with what was typed on the sign-in screen.
  const params = useLocalSearchParams<{ identifier?: string }>()
  const prefilled = typeof params.identifier === 'string' ? params.identifier : ''
  const [identifier, setIdentifier] = useState(prefilled)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const request = useMutation({
    mutationFn: (value: string) => requestReset(value),
    onSuccess: (_data, value) => setSentTo(value),
  })
  const wide = useAuthWide()
  const send = () => { if (identifier.trim() && !request.isPending) request.mutate(identifier.trim()) }

  // Recovering by phone: Firebase texts the code, and a verified number buys
  // a reset token straight away — no mailbox involved.
  const smsEnabled = useSmsEnabled()
  const [channel, setChannel] = useState<VerificationChannel>('email')
  // A prefilled identifier that is plainly a number starts the phone field.
  const [phone, setPhone] = useState(prefilled.startsWith('+') ? prefilled : '')
  const [challenge, setChallenge] = useState<SmsChallenge | null>(null)
  const [smsError, setSmsError] = useState('')
  const [sendingSms, setSendingSms] = useState(false)
  const bySms = smsEnabled && channel === 'sms'

  async function sendCode() {
    if (sendingSms || !phone) return
    setSmsError(''); setSendingSms(true)
    try {
      setChallenge(await sendSmsCode(phone))
    } catch (cause) {
      setSmsError(smsErrorMessage(cause, t))
    } finally {
      setSendingSms(false)
    }
  }

  /**
   * The verified number is traded for a reset token. An unknown number comes
   * back with an empty token and the same confirmation screen, so this never
   * reveals which numbers have an account.
   */
  async function useVerifiedNumber(idToken: string) {
    const { reset_token: token } = await authApi.smsForgotPassword(idToken)
    if (token) router.replace({ pathname: '/auth/reset-password', params: { token } })
    else { setChallenge(null); setSentTo(phone) }
  }

  const switcher = smsEnabled ? (
    <ChannelSwitch
      value={channel}
      onChange={(c) => { setChannel(c); setSmsError(''); request.reset() }}
      options={['email', 'sms']}
      label={t('auth.sms.recoverWith')}
    />
  ) : null

  // The code entry takes over the whole screen once a code is on its way.
  if (bySms && challenge) {
    const codeForm = (
      <SmsCodeForm
        challenge={challenge}
        initialError={smsError}
        onToken={useVerifiedNumber}
        onBack={() => setChallenge(null)}
      />
    )
    if (wide) return <AuthWideShell onBack={() => setChallenge(null)}>{codeForm}</AuthWideShell>
    return <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{codeForm}</KeyboardAwareScrollView>
  }

  const phoneForm = (
    <>
      <PhoneInput
        label={t('auth.sms.phoneLabel')}
        value={phone}
        onChange={setPhone}
        onSubmitEditing={() => void sendCode()}
        autoFocus={!phone}
        testID="forgot-phone"
      />
      {smsError ? <Text style={styles.error}>{smsError}</Text> : null}
      <Button title={t('auth.sms.sendCode')} loading={sendingSms} disabled={!phone} onPress={() => void sendCode()} />
    </>
  )

  const emailForm = (
    <>
      <Field
        label={t('auth.identifier')}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        autoFocus={!identifier}
        returnKeyType="send"
        onSubmitEditing={send}
        placeholder={t('auth.identifierPlaceholder')}
      />
      <Button title={t('auth.sendLink')} loading={request.isPending} disabled={!identifier.trim()} onPress={send} />
      {request.isError && <ErrorState message={t('auth.forgotFailed')} />}
    </>
  )

  if (wide) {
    // Large screens: same content in the shared navy + card frame (see login).
    if (sentTo) {
      return <AuthWideShell title={t('auth.forgotSentTitle')} subtitle={t('auth.forgotSentTo', { identifier: sentTo })}>
        <View style={styles.icon}><Ionicons name="mail-outline" size={26} color={colors.onGreen} /></View>
        <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/auth/login')} />
        {sentTo.startsWith('+') ? null : <ResendEmailButton label={t('auth.forgotResend')} onResend={() => requestReset(sentTo)} />}
        <Text style={[styles.link, styles.center]} onPress={() => { request.reset(); setSentTo(null) }}>{t('auth.useAnotherIdentifier')}</Text>
      </AuthWideShell>
    }
    return <AuthWideShell title={t('auth.recoverAccount')} subtitle={bySms ? t('auth.sms.recoverByPhoneBody') : t('auth.recoverAccountBody')}>
      {switcher}
      {bySms ? phoneForm : emailForm}
      <Text style={[styles.link, styles.center]} onPress={() => router.canGoBack() ? router.back() : router.replace('/auth/login')}>{t('auth.backToSignIn')}</Text>
    </AuthWideShell>
  }

  if (sentTo) {
    return <KeyboardAwareScrollView contentContainerStyle={styles.page}>
      <Card>
        <View style={styles.icon}><Ionicons name="mail-outline" size={26} color={colors.onGreen} /></View>
        <Text style={styles.sentTitle}>{t('auth.forgotSentTitle')}</Text>
        <Text style={[styles.muted, styles.center]}>{t('auth.forgotSentTo', { identifier: sentTo })}</Text>
        <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/auth/login')} />
        {sentTo.startsWith('+') ? null : <ResendEmailButton label={t('auth.forgotResend')} onResend={() => requestReset(sentTo)} />}
        <Text style={[styles.link, styles.center]} onPress={() => { request.reset(); setSentTo(null) }}>{t('auth.useAnotherIdentifier')}</Text>
      </Card>
    </KeyboardAwareScrollView>
  }

  return <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <SectionTitle title={t('auth.recoverAccount')} />
    <Text style={styles.muted}>{bySms ? t('auth.sms.recoverByPhoneBody') : t('auth.recoverAccountBody')}</Text>
    <Card>
      {switcher}
      {bySms ? phoneForm : emailForm}
    </Card>
    <Text style={[styles.link, styles.center]} onPress={() => router.back()}>{t('auth.backToSignIn')}</Text>
  </KeyboardAwareScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { flexGrow: 1, padding: spacing.md, gap: 12, backgroundColor: colors.cream },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  center: { textAlign: 'center' },
  link: { color: colors.green, fontWeight: '700', fontSize: 14, paddingVertical: 6 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm, fontSize: 14 },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sentTitle: { color: colors.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
})
