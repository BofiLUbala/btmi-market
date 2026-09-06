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
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.form}><Text style={styles.title}>{t('auth.welcomeBack')}</Text><Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/forgot-password')}><Text style={styles.link}>{t('auth.forgotPasswordLink')}</Text></Pressable><Button title={t('common.signIn')} loading={busy} disabled={!email || !password} onPress={submit}/><View style={styles.recovery}><Text style={styles.choiceTitle}>{t('auth.reinitialize.didNotReceive')}</Text><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/registration-recovery')}><Text style={styles.centerLink}>{t('auth.reinitialize.resend')}</Text></Pressable><Text style={styles.choiceTitle}>{t('auth.reinitialize.stillBlocked')}</Text><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/registration-recovery')}><Text style={styles.centerLink}>{t('auth.reinitialize.title')}</Text></Pressable></View><Text style={styles.choiceTitle}>{t('auth.noAccount')}</Text><Button title={t('auth.createAccount')} variant="outline" onPress={()=>router.push('/auth/register-choice')}/></View></KeyboardAvoidingView>
}
/** Web-only: the Expo Router Stack header on react-native-web overlays the
 *  screen (position: absolute) instead of reserving layout space for it like
 *  native Stack navigation does, so a centered page can render underneath a
 *  64px-tall header there. Gated to web so native Android/iOS — where the
 *  header already reserves its own space — gets no extra offset and no
 *  layout change. */
const webHeaderOffset = Platform.OS === 'web' ? 64 : 0
const makeStyles = (colors: Colors) => StyleSheet.create({ page: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.lg, paddingTop: spacing.lg + webHeaderOffset }, form: { gap: spacing.md }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, subtitle: { color: colors.muted }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 }, link:{color:colors.green,fontWeight:'800',textAlign:'right'}, centerLink:{color:colors.green,fontWeight:'800',textAlign:'center'}, recovery:{gap:spacing.xs}, signUp:{color:colors.green,fontWeight:'800',textAlign:'center'}, choiceTitle:{color:colors.muted,textAlign:'center',fontWeight:'700'},choiceRow:{gap:spacing.sm},choiceButton:{width:'100%'} })
