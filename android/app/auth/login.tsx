import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  async function submit() { setError(''); setBusy(true); try { const user = await login(email.trim(), password); router.replace(user.account_type === 'SELLER' ? '/seller' : '/(buyer)/profile') } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not sign in.') } finally { setBusy(false) } }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.form}><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Use the same BTMI account as on the Web.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><Button title="Sign in" loading={busy} disabled={!email || !password} onPress={submit}/></View></KeyboardAvoidingView>
}
const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.lg }, form: { gap: spacing.md }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, subtitle: { color: colors.muted }, error: { color: colors.danger, backgroundColor: '#FEECEB', padding: 12, borderRadius: 10 } })

