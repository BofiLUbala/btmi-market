import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { TranslationKey } from '../../src/locales/fr'
import { router } from 'expo-router'
import { authApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors, fonts } from '../../src/theme'
import { sellerIntent } from '../../src/store/sellerIntent'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { RememberMe, useRememberedEmail } from '../../src/components/AuthFormParts'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const refresh = useAuth((state) => state.refresh)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { email, setEmail, remember, setRemember, prefilled, persist } = useRememberedEmail('buyer')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notActivated, setNotActivated] = useState(false)
  const passwordRef = useRef<TextInput>(null)
  // A remembered e-mail is filled in: go straight to the password.
  useEffect(() => { if (prefilled) passwordRef.current?.focus() }, [prefilled])
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit() {
    if (busy || !email.trim() || !password) return
    setError(''); setNotActivated(false); setBusy(true)
    try {
      await login(email.trim().toLowerCase(), password)
      await persist(email)
      if (await sellerIntent.isFor(email)) {
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
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.code === 'INVALID_CREDENTIALS') setError(t('auth.invalidCredentials'))
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
  return <View style={styles.root}>
    <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>{w('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{w('auth.login.subtitle')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notActivated ? (
          <Text style={styles.linkLine}>
            {w('auth.reinitialize.didNotReceive')}{' '}
            <Text style={styles.link} onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'resend' } })}>{w('auth.reinitialize.resend')}</Text>
          </Text>
        ) : null}
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
            onPress={() => router.push({ pathname: '/auth/forgot-password', params: email.trim() ? { identifier: email.trim() } : {} })}
          >
            <Text style={styles.forgotText}>{w('auth.login.forgotPassword')}</Text>
          </Pressable>
        </View>
        <RememberMe checked={remember} onChange={setRemember} />
        <Button title={w('auth.login.submit')} loading={busy} disabled={!email.trim() || !password} onPress={submit} />
        <Text style={[styles.linkLine, styles.center]}>{w('auth.login.noAccount')} <Text style={styles.link} onPress={() => router.push('/auth/register')}>{w('auth.login.createOne')}</Text></Text>
      </View>
      <Pressable accessibilityRole="link" onPress={() => router.push('/admin/login')} style={styles.adminLink} hitSlop={6}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <Text style={styles.adminLinkText}>{t('auth.adminSpace')}</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  page: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  // web .auth-card
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.display, fontWeight: '500' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
  field: { gap: 8 },
  label: { color: colors.ink, fontWeight: '500', fontSize: 14 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  inputWithIcon: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12, top: 13 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  center: { textAlign: 'center' },
  adminLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, paddingVertical: 8 },
  adminLinkText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  linkLine: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  link: { color: colors.ink, fontWeight: '600' },
})
