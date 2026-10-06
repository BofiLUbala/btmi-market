import { useEffect, useMemo, useRef, useState } from 'react'
import { takePendingNotificationLink } from '../../src/lib/notificationRouting'
import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { TranslationKey } from '../../src/locales/fr'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { authApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors, fonts, kicker, radius, shadow } from '../../src/theme'
import { sellerIntent } from '../../src/store/sellerIntent'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { RememberMe, useRememberedEmail } from '../../src/components/AuthFormParts'
import { AuthWideShell } from '../../src/components/AuthWideShell'
import { ChannelSwitch, WhatsAppCodeForm, challengeFromError, useWhatsAppEnabled, whatsappErrorMessage } from '../../src/components/WhatsAppAuth'
import type { VerificationChannel, WhatsAppChallenge } from '../../src/api'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const verifyWhatsApp = useAuth((state) => state.verifyWhatsApp)
  const refresh = useAuth((state) => state.refresh)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, passwordPrefilled, persist, forgetPassword } = useRememberedEmail('buyer')
  const [error, setError] = useState('')
  const [notActivated, setNotActivated] = useState(false)
  const passwordRef = useRef<TextInput>(null)
  // A remembered e-mail is filled in: go straight to the password.
  useEffect(() => { if (prefilled && !passwordPrefilled) passwordRef.current?.focus() }, [prefilled, passwordPrefilled])
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const whatsappEnabled = useWhatsAppEnabled()
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [channel, setChannel] = useState<VerificationChannel>('email')
  const [phone, setPhone] = useState('')
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null)
  const [challengeError, setChallengeError] = useState('')
  const useWhatsApp = whatsappEnabled && channel === 'whatsapp'
  const identifier = useWhatsApp ? phone : email

  async function routeAfterLogin(accountEmail: string) {
    // Signing in from a tapped notification: open it now.
    const fromNotification = takePendingNotificationLink('USER', useAuth.getState().user?.id)
    if (fromNotification) {
      router.replace(fromNotification as never)
      return
    }
    if (await sellerIntent.isFor(accountEmail)) {
      await authApi.becomeSeller(); await refresh(); await sellerIntent.clear()
      router.replace('/seller/onboarding')
      return
    }
    const u = useAuth.getState().user
    if (u?.capabilities?.courier || u?.account_type === 'COURIER') {
      router.replace('/courier')
      return
    }
    if (u?.account_type === 'EMPLOYEE') {
      router.replace('/seller/employee')
      return
    }
    router.replace('/(buyer)')
  }

  async function submit() {
    if (busy || !identifier.trim() || !password) return
    setError(''); setNotActivated(false); setBusy(true)
    try {
      if (useWhatsApp) {
        try {
          setChallenge(await authApi.whatsappLogin(phone.trim(), password))
          setChallengeError('')
        } catch (cause) {
          const pending = challengeFromError(cause)
          if (!pending) throw cause
          setChallenge(pending)
          setChallengeError(whatsappErrorMessage(cause, t))
        }
        return
      }
      await login(email.trim().toLowerCase(), password)
      await persist(email, password)
      await routeAfterLogin(email)
    } catch (cause) {
      if (useWhatsApp) setError(whatsappErrorMessage(cause, t))
      else if (cause instanceof ApiError) {
        if (cause.code === 'INVALID_CREDENTIALS') { setError(t('auth.invalidCredentials')); if (passwordPrefilled) { setPassword(''); void forgetPassword() } }
        else if (cause.code === 'ACCOUNT_NOT_ACTIVATED') { setNotActivated(true); setError(t('auth.accountNotActivated')) }
        else if (cause.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.loginFailedGeneric'))
      } else setError(t('auth.loginFailed'))
    } finally { setBusy(false) }
  }

  const w = (key: string) => t(`web.${key}` as TranslationKey)

  // web LoginPage: one card — title, subtitle, fields, the only help link
  // ("Mot de passe oublié ?") under the password, remember me, submit.
  // Buyer, seller, employee and courier accounts all sign in here and are
  // routed by account type; administration has its own space.
  if (challenge) {
    const codeForm = <WhatsAppCodeForm
      challenge={challenge}
      initialError={challengeError}
      onVerify={async (id, code) => { const user = await verifyWhatsApp(id, code); await routeAfterLogin(user.email) }}
      onBack={() => setChallenge(null)}
    />
    // Large screens: the code entry in the shared centred card.
    if (wide) return <AuthWideShell onBack={() => setChallenge(null)}>{codeForm}</AuthWideShell>
    // Reference 14 "Code SMS": plain white page, back chevron, code entry.
    return <View style={[styles.codeRoot, { paddingTop: insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('auth.whatsapp.back')} onPress={() => setChallenge(null)} hitSlop={10} style={styles.codeBack}>
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </Pressable>
      <KeyboardAwareScrollView contentContainerStyle={styles.codePage} keyboardShouldPersistTaps="handled">
        {codeForm}
      </KeyboardAwareScrollView>
    </View>
  }

  // The brand block (logo, eyebrow, title) and the form are the same on every
  // screen size; only the frame around them changes.
  const brand = <>
        {router.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('auth.whatsapp.back')} onPress={() => router.back()} hitSlop={10} style={styles.heroBack}>
            <Ionicons name="chevron-back" size={22} color={colors.onNavy} />
          </Pressable>
        ) : null}
        <View style={styles.glow}>
          <View style={styles.logoTile}><Image source={LOGO} style={styles.logo} resizeMode="contain" /></View>
        </View>
        <Text style={styles.kicker}>{t('auth.login.kicker')}</Text>
        <Text style={styles.title}>{w('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{w('auth.login.subtitle')}</Text>
  </>
  const form = <>
        {whatsappEnabled ? <ChannelSwitch value={channel} onChange={(c) => { setChannel(c); setError('') }} label={t('auth.whatsapp.loginWith')} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notActivated ? (
          <Text style={styles.linkLine}>
            {w('auth.reinitialize.didNotReceive')}{' '}
            <Text style={styles.link} onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'resend' } })}>{w('auth.reinitialize.resend')}</Text>
          </Text>
        ) : null}
        {useWhatsApp ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.whatsapp.phoneLabel')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder={t('auth.whatsapp.phonePlaceholder')}
              placeholderTextColor={colors.faint}
              testID="login-phone"
            />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>{w('common.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder={w('auth.emailPlaceholder')}
              placeholderTextColor={colors.faint}
            />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>{w('auth.password')}</Text>
          <View>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.inputWithIcon]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              placeholder="••••••••"
              placeholderTextColor={colors.faint}
            />
            <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            style={styles.forgot}
            onPress={() => router.push({ pathname: '/auth/forgot-password', params: identifier.trim() ? { identifier: identifier.trim() } : {} })}
          >
            <Text style={styles.forgotText}>{w('auth.login.forgotPassword')}</Text>
          </Pressable>
        </View>
        {!useWhatsApp ? <RememberMe checked={remember} onChange={setRemember} /> : null}
        <Button title={useWhatsApp ? t('auth.whatsapp.sendCode') : w('auth.login.submit')} loading={busy} disabled={!identifier.trim() || !password} onPress={submit} />
        <Text style={[styles.linkLine, styles.center]}>{w('auth.login.noAccount')} <Text style={styles.link} onPress={() => router.push('/auth/register')}>{w('auth.login.createOne')}</Text></Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/admin/login')} style={styles.adminLink} hitSlop={6}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
          <Text style={styles.adminLinkText}>{t('auth.adminSpace')}</Text>
        </Pressable>
  </>

  if (wide) {
    // Large screens (web, tablets): the form in the shared centred card
    // instead of a phone layout stretched edge to edge.
    return <AuthWideShell title={w('auth.login.title')} subtitle={w('auth.login.subtitle')}>{form}</AuthWideShell>
  }

  return <View style={styles.root}>
    <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        {brand}
      </View>
      <View style={styles.card}>
        {form}
      </View>
    </KeyboardAwareScrollView>
  </View>
}

const LOGO = require('../../assets/icon.png')

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  page: { flexGrow: 1 },
  // Navy hero (reference 7): glowing logo tile, white title, muted subtitle.
  hero: { paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 8 },
  heroBack: { position: 'absolute', left: spacing.md, top: 12, zIndex: 1, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navySoft, alignItems: 'center', justifyContent: 'center' },
  glow: { alignSelf: 'center', width: 168, height: 168, borderRadius: 84, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, alignItems: 'center', justifyContent: 'center', marginTop: 36, marginBottom: 28 },
  logoTile: { width: 104, height: 104, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  logo: { width: 104, height: 104 },
  kicker: { ...kicker, color: colors.cyan },
  codeRoot: { flex: 1, backgroundColor: colors.white },
  codeBack: { marginLeft: spacing.sm, marginTop: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  codePage: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.onNavy, fontSize: 26, lineHeight: 32, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.onNavyMuted, fontSize: 14, lineHeight: 21 },
  // White rounded-top sheet holding the form.
  card: { flexGrow: 1, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: 14 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm, fontSize: 14 },
  field: { gap: 8 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
  inputWithIcon: { paddingRight: 44 },
  eye: { position: 'absolute', right: 14, top: 16 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { color: colors.green, fontWeight: '600', fontSize: 13 },
  center: { textAlign: 'center' },
  adminLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingVertical: 8 },
  adminLinkText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  linkLine: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  link: { color: colors.green, fontWeight: '700' },
})
