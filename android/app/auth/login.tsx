import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
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
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  async function submit() {
    if (busy) return
    setError(''); setBusy(true)
    try {
      const user = await login(email.trim().toLowerCase(), password)
      if (await sellerIntent.isFor(email)) {
        await authApi.becomeSeller()
        await refresh()
        await sellerIntent.clear()
        router.replace('/seller/onboarding')
        return
      }
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
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.form}><Text style={styles.title}>{t('auth.welcomeBack')}</Text><Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/forgot-password')}><Text style={styles.link}>{t('auth.forgotPasswordLink')}</Text></Pressable><Button title={t('common.signIn')} loading={busy} disabled={!email || !password} onPress={submit}/><Text style={styles.choiceTitle}>{t('auth.noAccount')}</Text><View style={styles.choiceRow}><Button style={styles.choiceButton} title={t('auth.register.createBuyer')} variant="outline" onPress={()=>router.push({ pathname: '/auth/register', params: { type: 'buyer' } })}/><Button style={styles.choiceButton} title={t('auth.register.createSeller')} onPress={()=>router.push({ pathname: '/auth/register', params: { type: 'seller' } })}/></View></View></KeyboardAvoidingView>
}
const makeStyles = (colors: Colors) => StyleSheet.create({ page: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.lg }, form: { gap: spacing.md }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, subtitle: { color: colors.muted }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 }, link:{color:colors.green,fontWeight:'800',textAlign:'right'}, signUp:{color:colors.green,fontWeight:'800',textAlign:'center'}, choiceTitle:{color:colors.muted,textAlign:'center',fontWeight:'700'},choiceRow:{gap:spacing.sm},choiceButton:{width:'100%'} })
