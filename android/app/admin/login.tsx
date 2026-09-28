import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../src/store/adminAuth'
import { useI18n } from '../../src/store/i18n'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { RememberMe, useRememberedEmail } from '../../src/components/AuthFormParts'

export default function AdminLoginScreen() {
  const router = useRouter()
  const login = useAdminAuth((s) => s.login)
  const { t } = useI18n()

  const { email, setEmail, remember, setRemember, prefilled, persist } = useRememberedEmail('admin')
  const passwordRef = useRef<TextInput>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotHelp, setShowForgotHelp] = useState(false)
  useEffect(() => { if (prefilled) passwordRef.current?.focus() }, [prefilled])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('admin.login.missingCreds'))
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      await persist(email)
      router.replace('/admin')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('admin.login.invalidCredentials')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#090d16' }}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoBadge}>
            <Text style={{ fontSize: 32 }}>🏛️</Text>
          </View>

          <Text style={styles.title}>{t('admin.login.title')}</Text>
          <Text style={styles.subtitle}>{t('admin.login.subtitle')}</Text>

          <View style={styles.securityBanner}>
            <Text style={{ fontSize: 16 }}>🛡️</Text>
            <Text style={styles.securityText}>
              {t('admin.login.securityNotice')}
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('admin.login.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder={t('admin.login.emailPlaceholder')}
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('admin.login.passwordLabel')}</Text>
            <View>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { paddingRight: 44 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                placeholder={t('admin.login.passwordPlaceholder')}
                placeholderTextColor="#64748b"
              />
              <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
              </Pressable>
            </View>
            <Pressable onPress={() => setShowForgotHelp((v) => !v)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
              <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '600' }}>{t('auth.forgotPasswordLink')}</Text>
            </Pressable>
            {showForgotHelp ? <Text style={styles.forgotHelp}>{t('auth.adminForgotHelp')}</Text> : null}
          </View>

          <View style={{ marginBottom: 12 }}>
            <RememberMe checked={remember} onChange={setRemember} dark />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, submitting && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>{t('admin.login.submit')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20, alignItems: 'center' }}
            onPress={() => router.replace('/')}
          >
            <Text style={{ color: '#64748b', fontSize: 12 }}>{t('admin.login.returnToMarketplace')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  securityBanner: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#3730a3',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    alignItems: 'center',
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    color: '#c7d2fe',
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#991b1b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  eye: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  forgotHelp: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#cbd5e1',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
})
