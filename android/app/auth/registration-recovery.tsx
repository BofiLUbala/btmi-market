import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { authApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { AuthWideShell, useAuthWide } from '../../src/components/AuthWideShell'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function RegistrationRecoveryScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const { t } = useI18n(); const colors = useColors(); const styles = useMemo(() => makeStyles(colors), [colors])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false); const [mode, setMode] = useState<'resend'|'reinitialize'>(params.mode === 'reinitialize' ? 'reinitialize' : 'resend')
  const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const wide = useAuthWide()
  async function submit() {
    if (busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      if (mode === 'resend') { await authApi.resendActivation(email.trim().toLowerCase()); setMessage(t('auth.reinitialize.resendSuccess')) }
      else { await authApi.reinitializeRegistration(email.trim().toLowerCase()); setMessage(t('auth.reinitialize.success')) }
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : t('auth.reinitialize.failed')) }
    finally { setBusy(false) }
  }
  if (wide) {
    // Large screens: same content in the shared navy + card frame (see login).
    return <AuthWideShell
      title={mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')}
      subtitle={mode === 'resend' ? t('auth.reinitialize.didNotReceive') : t('auth.reinitialize.explanation')}
    >
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
      <Button title={mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')} loading={busy} disabled={!email} onPress={submit}/>
      <Text style={styles.body}>{t('auth.reinitialize.stillBlocked')}</Text>
      <Button title={mode === 'resend' ? t('auth.reinitialize.title') : t('auth.reinitialize.resend')} variant="outline" onPress={()=>{setMode(mode === 'resend' ? 'reinitialize' : 'resend'); setMessage(''); setError('')}}/>
      <Button title={t('auth.reinitialize.back')} variant="outline" onPress={()=>router.replace('/auth/login')}/>
    </AuthWideShell>
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')}</Text><Text style={styles.body}>{mode === 'resend' ? t('auth.reinitialize.didNotReceive') : t('auth.reinitialize.explanation')}</Text>{message ? <Text style={styles.success}>{message}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Button title={mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')} loading={busy} disabled={!email} onPress={submit}/><Text style={styles.body}>{t('auth.reinitialize.stillBlocked')}</Text><Button title={mode === 'resend' ? t('auth.reinitialize.title') : t('auth.reinitialize.resend')} variant="outline" onPress={()=>{setMode(mode === 'resend' ? 'reinitialize' : 'resend'); setMessage(''); setError('')}}/><Button title={t('auth.reinitialize.back')} variant="outline" onPress={()=>router.replace('/auth/login')}/></ScrollView></KeyboardAvoidingView>
}
const makeStyles = (c: Colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.cream },
  content: { padding: spacing.md, gap: 12, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: c.ink },
  body: { color: c.muted, fontSize: 14, lineHeight: 21 },
  success: { color: c.success, backgroundColor: c.successSoft, padding: 12, borderRadius: 12, fontSize: 14 },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: 12, fontSize: 14 },
})
