import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  async function submit() {
    if (busy) return
    setError(''); setBusy(true)
    try {
      const user = await login(email.trim().toLowerCase(), password)
      router.replace(user.account_type === 'SELLER' ? '/seller' : '/(buyer)/profile')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'INVALID_CREDENTIALS') setError(t('auth.invalidCredentials'))
        else if (e.code === 'ACCOUNT_NOT_ACTIVATED') setError(t('auth.accountNotActivated'))
        else if (e.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.loginFailedGeneric'))
      } else setError(t('auth.loginFailed'))
    } finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.form}><Text style={styles.title}>{t('auth.welcomeBack')}</Text><Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/forgot-password')}><Text style={styles.link}>{t('auth.forgotPasswordLink')}</Text></Pressable><Button title={t('common.signIn')} loading={busy} disabled={!email || !password} onPress={submit}/></View></KeyboardAvoidingView>
}
const makeStyles = (colors: Colors) => StyleSheet.create({ page: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.lg }, form: { gap: spacing.md }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, subtitle: { color: colors.muted }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 }, link:{color:colors.green,fontWeight:'800',textAlign:'right'} })