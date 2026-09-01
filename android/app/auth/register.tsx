import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, Field, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/** Same rules the API enforces in IsStrongPassword — checked here only so the
 *  requirements are visible while typing, never as a replacement for the
 *  server-side check. */
const PASSWORD_RULES = [
  (value: string) => value.length >= 8,
  (value: string) => value.length <= 64,
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[0-9]/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
]

export default function RegisterScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  const rules = useMemo(() => PASSWORD_RULES.map((rule) => rule(password)), [password])
  const ruleLabels = useMemo(
    () => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')],
    [t]
  )
  const matches = confirmation.length > 0 && password === confirmation
  const valid = Boolean(firstName.trim() && lastName.trim() && phone.trim() && email.trim()) && rules.every(Boolean) && matches

  const register = useMutation({
    mutationFn: () => authApi.register({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      password,
      password_confirmation: confirmation,
    }),
    onMutate: () => setError(''),
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_ALREADY_EXISTS') setError(t('auth.register.emailExists'))
        else if (e.code === 'PHONE_ALREADY_EXISTS') setError(t('auth.register.phoneExists'))
        else if (e.code === 'PASSWORD_TOO_WEAK') setError(t('auth.register.passwordTooWeak'))
        else if (e.code === 'PASSWORD_CONFIRMATION_MISMATCH') setError(t('auth.passwordsMismatch'))
        else if (e.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.register.failed'))
      } else setError(t('auth.register.failed'))
    },
  })

  // The account exists but is inactive until the emailed link is opened, so
  // there is nothing to sign into yet — offer a resend and the login screen.
  const resend = useMutation({ mutationFn: () => authApi.resendActivation(email.trim().toLowerCase()) })

  if (register.isSuccess) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <SectionTitle title={t('auth.register.created')} />
        <Card>
          <Text style={styles.success}>{t('auth.register.checkEmail')}</Text>
          <Text style={styles.muted}>{t('auth.register.sentLinkToEmail', { email: email.trim().toLowerCase() })}</Text>
          <Text style={styles.muted}>{t('auth.register.linkValidity')}</Text>
          {resend.isSuccess ? <Text style={styles.success}>{t('auth.register.resendSent')}</Text> : null}
          {resend.isError ? <Text style={styles.error}>{t('auth.register.resendFailed')}</Text> : null}
          <Button
            title={t('auth.register.resendActivation')}
            variant="outline"
            loading={resend.isPending}
            disabled={resend.isSuccess}
            onPress={() => resend.mutate()}
          />
          <Button title={t('auth.register.goToSignIn')} onPress={() => router.replace('/auth/login')} />
        </Card>
      </ScrollView>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <SectionTitle title={t('auth.register.title')} />
        <Text style={styles.muted}>{t('auth.register.subtitle')}</Text>
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        <Card>
          <Field label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
          <Field label={t('auth.lastName')} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" />
          <Field label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder={t('auth.phonePlaceholder')} />
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={64} />
          <View>
            {ruleLabels.map((label, index) => (
              <Text key={label} style={[styles.rule, rules[index] && styles.success]}>{rules[index] ? '✓' : '○'} {label}</Text>
            ))}
          </View>
          <Field label={t('auth.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" maxLength={64} />
          {confirmation.length > 0 ? (
            <Text style={matches ? styles.success : styles.error}>{matches ? t('auth.passwordsMatch') : t('auth.passwordsMismatch')}</Text>
          ) : null}
          <Button title={t('auth.register.submit')} loading={register.isPending} disabled={!valid} onPress={() => register.mutate()} />
        </Card>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/login')}>
          <Text style={styles.link}>{t('auth.register.alreadyRegistered')} {t('common.signIn')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md },
  muted: { color: colors.muted, lineHeight: 21 },
  rule: { color: colors.muted, lineHeight: 23 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 21 },
  error: { color: colors.danger, fontWeight: '800' },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 },
  link: { color: colors.green, fontWeight: '800', textAlign: 'center' },
})
