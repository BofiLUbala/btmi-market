import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/store/auth'
import { ApiError } from '../../src/api/client'
import { Button, Field } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function LoginScreen() {
  const login = useAuth((state) => state.login)
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  async function submit() {
    if (busy) return
    setError(''); setBusy(true)
    try {
      const user = await login(email.trim().toLowerCase(), password)
      router.replace(user.account_type === 'SELLER' ? '/seller' : '/(buyer)/profile')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'INVALID_CREDENTIALS') setError('Adresse email ou mot de passe incorrect.')
        else if (e.code === 'ACCOUNT_NOT_ACTIVATED') setError('Votre compte n’est pas encore activé. Vérifiez votre boîte email.')
        else if (e.code === 'NETWORK_ERROR') setError('Le téléphone ne parvient pas à joindre le serveur TBK. Vérifiez le Wi-Fi puis réessayez.')
        else setError('Connexion impossible pour le moment. Réessayez.')
      } else setError('Connexion impossible. Réessayez.')
    } finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.form}><Text style={styles.title}>Bon retour parmi nous</Text><Text style={styles.subtitle}>Connectez-vous avec votre compte TBK.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Field label="Adresse email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><Pressable accessibilityRole="link" onPress={()=>router.push('/auth/forgot-password')}><Text style={styles.link}>Mot de passe oublié ?</Text></Pressable><Button title="Se connecter" loading={busy} disabled={!email || !password} onPress={submit}/></View></KeyboardAvoidingView>
}
const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.lg }, form: { gap: spacing.md }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, subtitle: { color: colors.muted }, error: { color: colors.danger, backgroundColor: '#FEECEB', padding: 12, borderRadius: 10 }, link:{color:colors.green,fontWeight:'800',textAlign:'right'} })
