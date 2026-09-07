import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { authApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { sellerIntent } from '../../src/store/sellerIntent'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const refresh = useAuth((state) => state.refresh)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setError(''); setBusy(true)
    try {
      await login(email.trim().toLowerCase(), password)
      if (await sellerIntent.isFor(email)) {
        await authApi.becomeSeller(); await refresh(); await sellerIntent.clear()
        router.replace('/seller/onboarding')
        return
      }
      router.replace('/(buyer)')
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.code === 'INVALID_CREDENTIALS') setError(t('auth.invalidCredentials'))
        else if (cause.code === 'ACCOUNT_NOT_ACTIVATED') setError(t('auth.accountNotActivated'))
        else if (cause.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.loginFailedGeneric'))
      } else setError(t('auth.loginFailed'))
    } finally { setBusy(false) }
  }

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        <Pressable accessibilityRole="link" onPress={() => router.push('/auth/forgot-password')}><Text style={styles.link}>{t('auth.forgotPasswordLink')}</Text></Pressable>
        <Button title={t('common.signIn')} loading={busy} disabled={!email || !password} onPress={submit} />

        <View style={styles.recovery}>
          <Text style={styles.recoveryTitle}>{t('auth.reinitialize.helpTitle')}</Text>
          <Text style={styles.choiceTitle}>{t('auth.reinitialize.didNotReceive')}</Text>
          <Button title={t('auth.reinitialize.resend')} variant="outline" onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'resend' } })} />
          <Text style={styles.choiceTitle}>{t('auth.reinitialize.stillBlocked')}</Text>
          <Button title={t('auth.reinitialize.title')} variant="outline" onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'reinitialize' } })} />
        </View>

        <Text style={styles.choiceTitle}>{t('auth.noAccount')}</Text>
        <Button title={t('auth.createAccount')} variant="outline" onPress={() => router.push('/auth/register')} />
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}

const webHeaderOffset = Platform.OS === 'web' ? 64 : 0
const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  page: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingTop: spacing.lg + webHeaderOffset },
  form: { gap: spacing.md },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 },
  link: { color: colors.green, fontWeight: '800', textAlign: 'right' },
  recovery: { gap: spacing.sm, marginTop: spacing.xs },
  recoveryTitle: { color: colors.ink, fontWeight: '900', textAlign: 'center', fontSize: 16 },
  choiceTitle: { color: colors.muted, textAlign: 'center', fontWeight: '700' },
})
