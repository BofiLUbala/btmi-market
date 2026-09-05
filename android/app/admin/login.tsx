import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../src/store/adminAuth'
import { useI18n } from '../../src/store/i18n'

export default function AdminLoginScreen() {
  const router = useRouter()
  const login = useAdminAuth((s) => s.login)
  const { t } = useI18n()

  const [email, setEmail] = useState('')
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
      router.replace('/admin')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('admin.login.invalidCredentials')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#090d16' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
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
              keyboardType="email-address"
              placeholder={t('admin.login.emailPlaceholder')}
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('admin.login.passwordLabel')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t('admin.login.passwordPlaceholder')}
              placeholderTextColor="#64748b"
            />
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
      </ScrollView>
    </KeyboardAvoidingView>
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
