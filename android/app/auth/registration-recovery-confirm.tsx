import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/**
 * Second half of a registration reinitialization: the emailed token plus a new
 * password. `/auth/registration-recovery` only asks for the address and sends
 * the mail; it cannot spend a token, which is why the link needed a screen of
 * its own rather than reusing that one.
 */
export default function RegistrationRecoveryConfirmScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const rules = useMemo(
    () => [password.length >= 8, password.length <= 64, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)],
    [password]
  )
  const ruleLabels = useMemo(
    () => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')],
    [t]
  )
  const matches = confirmation.length > 0 && password === confirmation
  const valid = Boolean(token) && email.trim().length > 0 && rules.every(Boolean) && matches

  const confirm = useMutation({
    mutationFn: () => authApi.completeReinitialization({ token, email: email.trim().toLowerCase(), password, password_confirmation: confirmation }),
  })

  if (!token) {
    return (
      <View style={styles.page}>
        <SectionTitle title={t('auth.reinitialize.confirmTitle')} />
        <ErrorState message={t('auth.reinitialize.invalidLink')} retry={() => router.replace('/auth/registration-recovery')} actionLabel={t('auth.reinitialize.resend')} />
      </View>
    )
  }

  if (confirm.isSuccess) {
    return (
      <View style={styles.page}>
        <SectionTitle title={t('auth.reinitialize.confirmTitle')} />
        <Card>
          <Text style={styles.met}>{t('auth.activate.active')}</Text>
          <Button title={t('common.signIn')} onPress={() => router.replace('/auth/login')} />
        </Card>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <SectionTitle title={t('auth.reinitialize.confirmTitle')} />
      <Card>
        <Text style={styles.body}>{t('auth.reinitialize.confirmExplanation')}</Text>
        <Field label={t('common.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label={t('auth.reinitialize.newPassword')} value={password} onChangeText={setPassword} secureTextEntry maxLength={64} />
        <View>{ruleLabels.map((label, index) => <Text key={label} style={[styles.rule, rules[index] && styles.met]}>{rules[index] ? '✓' : '○'} {label}</Text>)}</View>
        <Field label={t('auth.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={64} />
        {confirmation.length > 0 && <Text style={matches ? styles.met : styles.error}>{matches ? t('auth.passwordsMatch') : t('auth.passwordsMismatch')}</Text>}
        <Button title={t('auth.reinitialize.confirmSubmit')} loading={confirm.isPending} disabled={!valid} onPress={() => confirm.mutate()} />
        {confirm.isError && <Text style={styles.error}>{confirm.error instanceof ApiError ? confirm.error.message : t('auth.reinitialize.failed')}</Text>}
      </Card>
      <Button title={t('common.signIn')} variant="outline" onPress={() => router.replace('/auth/login')} />
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.cream, padding: spacing.md, gap: spacing.sm },
    body: { color: c.muted, fontSize: 14 },
    rule: { color: c.muted, fontSize: 13 },
    met: { color: c.success, fontSize: 13, fontWeight: '700' },
    error: { color: c.danger, fontSize: 13, fontWeight: '700' },
  })
