import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, Field, SectionTitle } from '../../src/components/ui'
import { SellerPolicyContent } from '../../src/components/SellerPolicyContent'
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

  const [accountType, setAccountType] = useState<'BUYER' | 'SELLER'>('BUYER')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [policyModalVisible, setPolicyModalVisible] = useState(false)

  const rules = useMemo(() => PASSWORD_RULES.map((rule) => rule(password)), [password])
  const ruleLabels = useMemo(
    () => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')],
    [t]
  )
  const matches = confirmation.length > 0 && password === confirmation
  const valid =
    Boolean(firstName.trim() && lastName.trim() && phone.trim() && email.trim()) &&
    rules.every(Boolean) &&
    matches &&
    (accountType === 'BUYER' || policyAccepted)

  const register = useMutation({
    mutationFn: () => {
      const body = {
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        password_confirmation: confirmation,
      }
      return accountType === 'SELLER' ? authApi.registerSeller(body) : authApi.register(body)
    },
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
        <SectionTitle title={accountType === 'SELLER' ? t('auth.register.sellerTitle') : t('auth.register.title')} />
        <Text style={styles.muted}>{accountType === 'SELLER' ? t('auth.register.sellerSubtitle') : t('auth.register.subtitle')}</Text>
        <View style={styles.typeRow}>
          <Pressable
            style={[styles.typeOption, accountType === 'BUYER' && styles.typeOptionActive]}
            onPress={() => setAccountType('BUYER')}
            accessibilityRole="button"
            accessibilityState={{ selected: accountType === 'BUYER' }}
          >
            <Text style={[styles.typeLabel, accountType === 'BUYER' && styles.typeLabelActive]}>{t('auth.register.buyerAccount')}</Text>
          </Pressable>
          <Pressable
            style={[styles.typeOption, accountType === 'SELLER' && styles.typeOptionActive]}
            onPress={() => setAccountType('SELLER')}
            accessibilityRole="button"
            accessibilityState={{ selected: accountType === 'SELLER' }}
          >
            <Text style={[styles.typeLabel, accountType === 'SELLER' && styles.typeLabelActive]}>{t('auth.register.sellerAccount')}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        <Card>
          <Field label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
          {accountType === 'SELLER' && (
            <Field label={t('auth.middleName')} value={middleName} onChangeText={setMiddleName} autoCapitalize="words" autoComplete="additional-name" />
          )}
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
          {accountType === 'SELLER' && (
            <Pressable
              style={styles.policyRow}
              onPress={() => setPolicyAccepted((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: policyAccepted }}
            >
              <View style={[styles.checkbox, policyAccepted && styles.checkboxChecked]}>
                {policyAccepted && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.policyText}>
                {t('seller.policy.consentPrefix')}{' '}
                <Text style={styles.policyLink} onPress={() => setPolicyModalVisible(true)}>
                  {t('seller.policy.navLabel')}
                </Text>
              </Text>
            </Pressable>
          )}
          <Button title={t('auth.register.submit')} loading={register.isPending} disabled={!valid} onPress={() => register.mutate()} />
        </Card>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/login')}>
          <Text style={styles.link}>{t('auth.register.alreadyRegistered')} {t('common.signIn')}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={policyModalVisible} animationType="slide" onRequestClose={() => setPolicyModalVisible(false)}>
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.cream }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('seller.policy.title')}</Text>
            <Button title={t('common.close')} variant="outline" onPress={() => setPolicyModalVisible(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <SellerPolicyContent />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  typeRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.white },
  typeOptionActive: { backgroundColor: colors.green },
  typeLabel: { fontWeight: '800', color: colors.ink },
  typeLabelActive: { color: colors.white },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  checkboxMark: { color: colors.white, fontSize: 13, fontWeight: '900' },
  policyText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  policyLink: { color: colors.gold, fontWeight: '800' },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  modalBody: { padding: spacing.md, paddingBottom: spacing.xl },
})
