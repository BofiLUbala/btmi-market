import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api'
import { ApiError } from '../api/client'
import { Button, Card, Field, SectionTitle } from './ui'
import { SellerPolicyContent } from './SellerPolicyContent'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { sellerIntent } from '../store/sellerIntent'
import { useAuth } from '../store/auth'
import { isKinshasa } from '../lib/drcLocations'
import { radius, spacing, type Colors } from '../theme'

const PASSWORD_RULES = [
  (value: string) => value.length >= 8,
  (value: string) => value.length <= 64,
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[0-9]/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
]

const canonicalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0') ? `243${digits.slice(1)}` : digits
}

export function RegisterFlow({ accountType }: { accountType: 'BUYER' | 'SELLER' }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  
  // Step 1: Account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  // Step 2: Personal
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [backupPhone, setBackupPhone] = useState('')

  // Step 3: Address & Location
  const [country, setCountry] = useState('République Démocratique du Congo')
  const [city, setCity] = useState('Kinshasa')
  const [commune, setCommune] = useState('Gombe')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [policyModalVisible, setPolicyModalVisible] = useState(false)
  const automaticLoginRunning = useRef(false)

  const rules = useMemo(() => PASSWORD_RULES.map((rule) => rule(password)), [password])
  const ruleLabels = useMemo(
    () => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')],
    [t]
  )
  const matches = confirmation.length > 0 && password === confirmation

  function validateStep(currentStep: number): boolean {
    setError('')
    if (currentStep === 1) {
      if (!email.trim() || !email.includes('@')) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      if (!rules.every(Boolean)) {
        setError(t('auth.register.passwordTooWeak'))
        return false
      }
      if (!matches) {
        setError(t('auth.passwordsMismatch'))
        return false
      }
      return true
    }

    if (currentStep === 2) {
      if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      if (backupPhone.trim() && canonicalPhone(phone) === canonicalPhone(backupPhone)) {
        setError(t('editProfile.backupPhoneMustDiffer'))
        return false
      }
      return true
    }

    if (currentStep === 3) {
      if (!country.trim() || !city.trim() || !address.trim()) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      return true
    }

    return true
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 4) as 1 | 2 | 3 | 4)
    }
  }

  function prevStep() {
    setError('')
    setStep((s) => Math.max(s - 1, 1) as 1 | 2 | 3 | 4)
  }

  const register = useMutation({
    mutationFn: () => {
      const body = {
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        phone: phone.trim(),
        backup_phone: backupPhone.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        password_confirmation: confirmation,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        commune: commune.trim() || undefined,
        address: address.trim() || undefined,
        latitude,
        longitude,
      }
      return accountType === 'SELLER' ? authApi.registerSeller(body) : authApi.register(body)
    },
    onMutate: () => setError(''),
    onSuccess: async () => {
      if (accountType === 'SELLER') await sellerIntent.set(email)
      else await sellerIntent.clear()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_ALREADY_EXISTS') setError(t(accountType === 'SELLER' ? 'auth.register.sellerEmailExists' : 'auth.register.emailExists'))
        else if (e.code === 'PHONE_ALREADY_EXISTS') setError(t('auth.register.phoneExists'))
        else if (e.code === 'PASSWORD_TOO_WEAK') setError(t('auth.register.passwordTooWeak'))
        else if (e.code === 'PASSWORD_CONFIRMATION_MISMATCH') setError(t('auth.passwordsMismatch'))
        else if (e.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.register.failed'))
      } else setError(t('auth.register.failed'))
    },
  })

  const resend = useMutation({ mutationFn: () => authApi.resendActivation(email.trim().toLowerCase()) })

  useEffect(() => {
    if (!register.isSuccess) return
    const connectAfterActivation = async () => {
      if (automaticLoginRunning.current) return
      automaticLoginRunning.current = true
      try {
        const user = await useAuth.getState().login(email.trim().toLowerCase(), password)
        await sellerIntent.clear()
        router.replace(user.account_type === 'SELLER' ? '/seller/onboarding' : '/(buyer)/profile')
      } catch {
        // Automatic login retry will fire on next active state
      } finally {
        automaticLoginRunning.current = false
      }
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void connectAfterActivation()
    })
    return () => subscription.remove()
  }, [accountType, email, password, register.isSuccess])

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

        <View style={[styles.flowBanner, accountType === 'SELLER' ? styles.sellerBanner : styles.buyerBanner]}>
          <Text style={styles.flowBannerText}>
            {accountType === 'SELLER' ? t('auth.register.sellerFlowLabel') : t('auth.register.buyerFlowLabel')}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepsRow}>
          <Pressable
            style={[styles.stepBadge, step === 1 && styles.stepBadgeActive, step > 1 && styles.stepBadgeDone]}
            onPress={() => step > 1 && setStep(1)}
          >
            <Text style={[styles.stepBadgeText, (step === 1 || step > 1) && styles.stepBadgeTextActive]}>
              {step > 1 ? '✓' : '1'} {t('auth.register.stepAccount')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stepBadge, step === 2 && styles.stepBadgeActive, step > 2 && styles.stepBadgeDone]}
            onPress={() => step > 2 && setStep(2)}
          >
            <Text style={[styles.stepBadgeText, (step === 2 || step > 2) && styles.stepBadgeTextActive]}>
              {step > 2 ? '✓' : '2'} {t('auth.register.stepPersonal')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stepBadge, step === 3 && styles.stepBadgeActive, step > 3 && styles.stepBadgeDone]}
            onPress={() => step > 3 && setStep(3)}
          >
            <Text style={[styles.stepBadgeText, (step === 3 || step > 3) && styles.stepBadgeTextActive]}>
              {step > 3 ? '✓' : '3'} {t('auth.register.stepAddress')}
            </Text>
          </Pressable>
          <View style={[styles.stepBadge, step === 4 && styles.stepBadgeActive]}>
            <Text style={[styles.stepBadgeText, step === 4 && styles.stepBadgeTextActive]}>
              4 {t('auth.register.stepReview')}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        {/* Step 1: Account Credentials */}
        {step === 1 && (
          <Card>
            <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={t('auth.emailPlaceholder')} />
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
            <Button title={`${t('auth.register.next')} →`} onPress={nextStep} />
          </Card>
        )}

        {/* Step 2: Personal Information */}
        {step === 2 && (
          <Card>
            <Field label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
            {accountType === 'SELLER' && (
              <Field label={t('auth.middleName')} value={middleName} onChangeText={setMiddleName} autoCapitalize="words" autoComplete="additional-name" />
            )}
            <Field label={t('auth.lastName')} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" />
            <Field label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder={t('auth.phonePlaceholder')} />
            <Field label={t('auth.register.backupPhone')} value={backupPhone} onChangeText={setBackupPhone} keyboardType="phone-pad" placeholder={t('common.optional')} />
            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <Button title={`← ${t('auth.register.back')}`} variant="outline" onPress={prevStep} />
              </View>
              <View style={styles.btnCol}>
                <Button title={`${t('auth.register.next')} →`} onPress={nextStep} />
              </View>
            </View>
          </Card>
        )}

        {/* Step 3: Address & Location */}
        {step === 3 && (
          <Card>
            <Field label={t('auth.register.country')} value={country} onChangeText={setCountry} />
            <Field label={t('auth.register.city')} value={city} onChangeText={setCity} />
            <Field label={t('auth.register.commune')} value={commune} onChangeText={setCommune} placeholder={isKinshasa(city) ? 'Gombe, Limete, etc.' : t('common.optional')} />
            <Field label={t('auth.register.address')} value={address} onChangeText={setAddress} placeholder={t('auth.register.addressPlaceholder')} multiline />
            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <Button title={`← ${t('auth.register.back')}`} variant="outline" onPress={prevStep} />
              </View>
              <View style={styles.btnCol}>
                <Button title={`${t('auth.register.next')} →`} onPress={nextStep} />
              </View>
            </View>
          </Card>
        )}

        {/* Step 4: Review / Confirmation */}
        {step === 4 && (
          <Card>
            <Text style={styles.reviewHeading}>{t('auth.register.reviewTitle')}</Text>
            <Text style={styles.muted}>{t('auth.register.reviewSubtitle')}</Text>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.accountDetails')}</Text>
              <Text style={styles.summaryVal}>{email}</Text>
              <Text style={styles.summaryVal}>{accountType === 'SELLER' ? t('auth.register.sellerAccount') : t('auth.register.buyerAccount')}</Text>
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.personalDetails')}</Text>
              <Text style={styles.summaryVal}>{[firstName, middleName, lastName].filter(Boolean).join(' ')}</Text>
              <Text style={styles.summaryVal}>{phone}</Text>
              {backupPhone ? <Text style={styles.summaryVal}>{backupPhone} ({t('auth.register.backupPhone')})</Text> : null}
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.addressDetails')}</Text>
              <Text style={styles.summaryVal}>{country}</Text>
              <Text style={styles.summaryVal}>{[commune, city].filter(Boolean).join(', ')}</Text>
              <Text style={styles.summaryVal}>{address}</Text>
            </View>

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

            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <Button title={`← ${t('auth.register.back')}`} variant="outline" onPress={prevStep} disabled={register.isPending} />
              </View>
              <View style={[styles.btnCol, { flex: 1.5 }]}>
                <Button
                  title={t('auth.register.submit')}
                  loading={register.isPending}
                  disabled={accountType === 'SELLER' && !policyAccepted}
                  onPress={() => register.mutate()}
                />
              </View>
            </View>
          </Card>
        )}

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
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm },
  link: { color: colors.green, fontWeight: '800', textAlign: 'center', marginVertical: spacing.sm },
  flowBanner: { borderRadius: radius.sm, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  buyerBanner: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  sellerBanner: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  flowBannerText: { color: colors.ink, fontWeight: '900', textAlign: 'center' },
  stepsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  stepBadgeActive: { backgroundColor: colors.green, borderColor: colors.green },
  stepBadgeDone: { backgroundColor: colors.surfaceAlt, borderColor: colors.green },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  stepBadgeTextActive: { color: colors.white },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  btnCol: { flex: 1 },
  reviewHeading: { fontSize: 17, fontWeight: '900', color: colors.ink },
  summaryBlock: { padding: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, gap: 3 },
  summaryLabel: { fontSize: 12, fontWeight: '900', color: colors.gold, textTransform: 'uppercase' },
  summaryVal: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.xs },
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
