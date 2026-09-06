import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { authApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function RegistrationRecoveryScreen() {
  const { t } = useI18n(); const colors = useColors(); const styles = useMemo(() => makeStyles(colors), [colors])
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [mode, setMode] = useState<'resend'|'reinitialize'>('resend')
  const [message, setMessage] = useState(''); const [error, setError] = useState('')
  async function submit() {
    if (busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      if (mode === 'resend') { await authApi.resendActivation(email.trim().toLowerCase()); setMessage(t('auth.reinitialize.resendSuccess')) }
      else { await authApi.reinitializeRegistration(email.trim().toLowerCase(), password); setPassword(''); setMessage(t('auth.reinitialize.success')) }
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : t('auth.reinitialize.failed')) }
    finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')}</Text><Text style={styles.body}>{mode === 'resend' ? t('auth.reinitialize.didNotReceive') : t('auth.reinitialize.explanation')}</Text>{message ? <Text style={styles.success}>{message}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>{mode === 'reinitialize' ? <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/> : null}<Button title={mode === 'resend' ? t('auth.reinitialize.resend') : t('auth.reinitialize.title')} loading={busy} disabled={!email || (mode === 'reinitialize' && !password)} onPress={submit}/><Text style={styles.body}>{t('auth.reinitialize.stillBlocked')}</Text><Button title={mode === 'resend' ? t('auth.reinitialize.title') : t('auth.reinitialize.resend')} variant="outline" onPress={()=>{setMode(mode === 'resend' ? 'reinitialize' : 'resend'); setMessage(''); setError('')}}/><Button title={t('auth.reinitialize.back')} variant="outline" onPress={()=>router.replace('/auth/login')}/></ScrollView></KeyboardAvoidingView>
}
const makeStyles = (c: Colors) => StyleSheet.create({page:{flex:1,backgroundColor:c.cream},content:{padding:spacing.lg,gap:spacing.md,justifyContent:'center',flexGrow:1},title:{fontSize:28,fontWeight:'900',color:c.ink},body:{color:c.muted},success:{color:c.green,backgroundColor:c.greenSoft,padding:12,borderRadius:10},error:{color:c.danger,backgroundColor:c.dangerSoft,padding:12,borderRadius:10}})
