import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
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
  const [showPassword, setShowPassword] = useState(false)

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
        else if (cause.code === 'ACCOUNT_NOT_ACTIVATED') setError(t('auth.accountNotActivated'))
        else if (cause.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.loginFailedGeneric'))
      } else setError(t('auth.loginFailed'))
    } finally { setBusy(false) }
  }

  const w = (key: string) => t(`web.${key}` as TranslationKey)
  const roles: Array<{ label: string; onPress?: () => void }> = [
    { label: 'Acheteur' },
    { label: 'Vendeur' },
    { label: 'Livreur' },
    { label: 'Administration', onPress: () => router.push('/admin/login') },
  ]

  // web LoginPage: one card — title, subtitle, account type, fields, submit,
  // then the help links as plain text lines.
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>{w('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{w('auth.login.subtitle')}</Text>
        <View style={styles.roles}>
          {roles.map((role, index) => (
            <Pressable
              key={role.label}
              accessibilityRole="button"
              onPress={role.onPress}
              style={[styles.role, index === 0 && styles.roleOn]}
            >
              <Text style={[styles.roleText, index === 0 && styles.roleTextOn]}>{role.label}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.field}>
          <Text style={styles.label}>{w('common.email')}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={w('auth.emailPlaceholder')} placeholderTextColor={colors.faint} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{w('auth.password')}</Text>
          <View>
            <TextInput style={[styles.input, styles.inputWithIcon]} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="current-password" placeholder="••••••••" placeholderTextColor={colors.faint} />
            <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>
        <Button title={w('auth.login.submit')} loading={busy} disabled={!email || !password} onPress={submit} />
        <View style={styles.links}>
          <Text style={styles.linkLine}>{w('auth.login.noAccount')} <Text style={styles.link} onPress={() => router.push('/auth/register')}>{w('auth.login.createOne')}</Text></Text>
          <Text style={styles.linkLine}>{w('auth.login.notActivated')} <Text style={styles.link} onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'resend' } })}>{w('auth.login.resendEmail')}</Text></Text>
          <Text style={styles.linkLine}>{w('auth.reinitialize.stillBlocked')} <Text style={styles.link} onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'reinitialize' } })}>{w('auth.reinitialize.title')}</Text></Text>
          <Text style={styles.linkLine}>{w('auth.login.forgotPassword')} <Text style={styles.link} onPress={() => router.push('/auth/forgot-password')}>{w('auth.login.resetIt')}</Text></Text>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  page: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  // web .auth-card
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.display, fontWeight: '500' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  role: { flexBasis: '47%', flexGrow: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  roleOn: { backgroundColor: colors.ink },
  roleText: { color: colors.ink, fontWeight: '600', fontSize: 16 },
  roleTextOn: { color: colors.onGreen },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
  field: { gap: 8 },
  label: { color: colors.ink, fontWeight: '500', fontSize: 14 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  inputWithIcon: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12, top: 13 },
  links: { gap: 2 },
  linkLine: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  link: { color: colors.ink, fontWeight: '600' },
})
