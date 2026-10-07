import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthWideShell, useAuthWide } from './AuthWideShell'
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { confirmAction } from '../lib/confirmAction'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { prepareAvatarUpload } from '../lib/imageUpload'
import { useMutation } from '@tanstack/react-query'
import { authApi, type VerificationChannel, type WhatsAppChallenge } from '../api'
import { ApiError } from '../api/client'
import { Button, Card, Field, SectionTitle } from './ui'
import { ResendEmailButton } from './AuthFormParts'
import { ChannelSwitch, WhatsAppCodeForm, challengeFromError, useWhatsAppEnabled, whatsappErrorMessage } from './WhatsAppAuth'
import { SellerPolicyContent } from './SellerPolicyContent'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { sellerIntent } from '../store/sellerIntent'
import { useAuth } from '../store/auth'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from './StructuredAddressFields'
import { kicker, radius, spacing, type Colors } from '../theme'

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

export function RegisterFlow({ accountType: initialAccountType }: { accountType: 'BUYER' | 'SELLER' }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // "Je veux aussi vendre": switches between the buyer and seller sign-up.
  const [alsoSell, setAlsoSell] = useState(initialAccountType === 'SELLER')
  const accountType: 'BUYER' | 'SELLER' = alsoSell ? 'SELLER' : 'BUYER'
  // Optional profile photo: picked now, uploaded once the session opens.
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  
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
  const [address, setAddress] = useState<StructuredAddressValue>(() => ({ ...emptyStructuredAddress(), province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe' }))
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [existingSellerEmail, setExistingSellerEmail] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [policyModalVisible, setPolicyModalVisible] = useState(false)
  const whatsappEnabled = useWhatsAppEnabled()
  const [channel, setChannel] = useState<VerificationChannel>('email')
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null)
  const [challengeError, setChallengeError] = useState('')
  const useWhatsApp = whatsappEnabled && channel === 'whatsapp'
  const automaticLoginRunning = useRef(false)
  const wide = useAuthWide()

  async function pickPhoto(fromCamera: boolean) {
    const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      confirmAction(t(fromCamera ? 'profile.cameraNeeded' : 'profile.photosNeeded'), t(fromCamera ? 'profile.cameraNeededBody' : 'profile.photosNeededBody'))
      return
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync({ ...options, selectionLimit: 1 })
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0])
  }

  function choosePhoto() {
    confirmAction(t('profile.photoTitle'), undefined, [
      { text: t('profile.takePhoto'), onPress: () => void pickPhoto(true) },
      { text: t('profile.chooseFromGallery'), onPress: () => void pickPhoto(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  /** Best effort: a failed photo upload never blocks the new account. */
  async function uploadPendingPhoto() {
    if (!photo) return
    try {
      await authApi.uploadAvatar(await prepareAvatarUpload(photo))
      await useAuth.getState().refresh()
    } catch { /* the photo can be added later from the profile */ }
  }

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
      if (!address.street.trim() || !address.building_number.trim() || !isStructuredAddressComplete(address)) {
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
        country: 'DRC',
        ...address,
        address: [address.building_number, address.street, address.commune, address.city, address.province].filter(Boolean).join(', '),
        latitude,
        longitude,
        verification_channel: useWhatsApp ? 'whatsapp' as const : 'email' as const,
      }
      return accountType === 'SELLER' ? authApi.registerSeller(body) : authApi.register(body)
    },
    onMutate: () => { setError(''); setExistingSellerEmail(false) },
    onSuccess: async (data) => {
      if (accountType === 'SELLER') await sellerIntent.set(email)
      else await sellerIntent.clear()
      if (data?.challenge_id) {
        setChallengeError('')
        setChallenge(data as WhatsAppChallenge)
      }
    },
    onError: (e) => {
      const pending = challengeFromError(e)
      if (pending) {
        // The account exists, only the WhatsApp delivery failed: offer a resend.
        if (accountType === 'SELLER') void sellerIntent.set(email)
        setChallengeError(whatsappErrorMessage(e, t))
        setChallenge(pending)
        return
      }
      if (e instanceof ApiError && (e.code === 'WHATSAPP_UNAVAILABLE' || e.code === 'RATE_LIMITED')) {
        setError(whatsappErrorMessage(e, t))
        return
      }
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_ALREADY_EXISTS') {
          setError(t(accountType === 'SELLER' ? 'auth.register.sellerEmailExists' : 'auth.register.emailExists'))
          if (accountType === 'SELLER') {
            setExistingSellerEmail(true)
            void sellerIntent.set(email)
          }
        }
        else if (e.code === 'PHONE_ALREADY_EXISTS') setError(t('auth.register.phoneExists'))
        else if (e.code === 'PASSWORD_TOO_WEAK') setError(t('auth.register.passwordTooWeak'))
        else if (e.code === 'PASSWORD_CONFIRMATION_MISMATCH') setError(t('auth.passwordsMismatch'))
        else if (e.code === 'NETWORK_ERROR') setError(t('errors.network'))
        else setError(t('auth.register.failed'))
      } else setError(t('auth.register.failed'))
    },
  })

  useEffect(() => {
    if (!register.isSuccess || challenge) return
    const connectAfterActivation = async () => {
      if (automaticLoginRunning.current) return
      automaticLoginRunning.current = true
      try {
        const user = await useAuth.getState().login(email.trim().toLowerCase(), password)
        await uploadPendingPhoto()
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
  }, [accountType, email, password, register.isSuccess, challenge, photo])

  // Large screens: every state sits in the shared centred card; the inner
  // phone cards become plain groups so there is no card inside the card.
  const Box = wide ? FlatBox : Card

  if (challenge) {
    const codeForm = (
          <Box>
            <WhatsAppCodeForm
              challenge={challenge}
              initialError={challengeError}
              onVerify={async (id, code) => {
                const user = await useAuth.getState().verifyWhatsApp(id, code)
                await uploadPendingPhoto()
                await sellerIntent.clear()
                router.replace(user.account_type === 'SELLER' ? '/seller/onboarding' : '/(buyer)/profile')
              }}
            />
          </Box>
    )
    if (wide) return <AuthWideShell title={t('auth.whatsapp.created')}>{codeForm}</AuthWideShell>
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <SectionTitle title={t('auth.whatsapp.created')} />
          {codeForm}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  if (register.isSuccess) {
    const created = (
        <Box>
          <Text style={styles.success}>{t('auth.register.checkEmail')}</Text>
          <Text style={styles.muted}>{t('auth.register.sentLinkToEmail', { email: email.trim().toLowerCase() })}</Text>
          <Text style={styles.muted}>{t('auth.register.linkValidity')}</Text>
          <Button title={t('auth.register.goToSignIn')} onPress={() => router.replace('/auth/login')} />
          <ResendEmailButton
            label={t('auth.register.resendActivation')}
            onResend={() => authApi.resendActivation(email.trim().toLowerCase())}
          />
        </Box>
    )
    if (wide) return <AuthWideShell title={t('auth.register.created')}>{created}</AuthWideShell>
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <SectionTitle title={t('auth.register.created')} />
        {created}
      </ScrollView>
    )
  }

  const title = accountType === 'SELLER' ? t('auth.register.sellerTitle') : t('auth.register.title')
  const subtitle = accountType === 'SELLER' ? t('auth.register.sellerSubtitle') : t('auth.register.subtitle')
  const steps = <>
        <View style={[styles.flowBanner, wide && styles.flowBannerWide, accountType === 'SELLER' ? styles.sellerBanner : styles.buyerBanner]}>
          <Text style={styles.flowBannerText}>
            {accountType === 'SELLER' ? t('auth.register.sellerFlowLabel') : t('auth.register.buyerFlowLabel')}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[1, 2, 3, 4].map((n) => <View key={n} style={[styles.progressSeg, n <= step && styles.progressSegOn]} />)}
        </View>
        <View style={styles.stepsRow}>
          <Pressable
            style={[styles.stepBadge, step === 1 && styles.stepBadgeActive, step > 1 && styles.stepBadgeDone]}
            onPress={() => step > 1 && setStep(1)}
          >
            <Text style={[styles.stepBadgeText, (step === 1 || step > 1) && styles.stepBadgeTextActive]}>
              {step > 1 ? '✓ ' : ''}{t('auth.register.stepAccount')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stepBadge, step === 2 && styles.stepBadgeActive, step > 2 && styles.stepBadgeDone]}
            onPress={() => step > 2 && setStep(2)}
          >
            <Text style={[styles.stepBadgeText, (step === 2 || step > 2) && styles.stepBadgeTextActive]}>
              {step > 2 ? '✓ ' : ''}{t('auth.register.stepPersonal')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stepBadge, step === 3 && styles.stepBadgeActive, step > 3 && styles.stepBadgeDone]}
            onPress={() => step > 3 && setStep(3)}
          >
            <Text style={[styles.stepBadgeText, (step === 3 || step > 3) && styles.stepBadgeTextActive]}>
              {step > 3 ? '✓ ' : ''}{t('auth.register.stepAddress')}
            </Text>
          </Pressable>
          <View style={[styles.stepBadge, step === 4 && styles.stepBadgeActive]}>
            <Text style={[styles.stepBadgeText, step === 4 && styles.stepBadgeTextActive]}>
              {t('auth.register.stepReview')}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        {existingSellerEmail ? (
          <Button title={t('auth.register.goToSignIn')} onPress={() => router.replace('/auth/login')} />
        ) : null}

        {/* Step 1: Account Credentials */}
        {step === 1 && (
          <Box>
            <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={t('auth.emailPlaceholder')} />
            {whatsappEnabled ? (
              <View style={{ gap: 6 }}>
                <ChannelSwitch value={channel} onChange={setChannel} label={t('auth.whatsapp.confirmWith')} />
                <Text style={styles.muted}>{useWhatsApp ? t('auth.whatsapp.confirmHintWhatsApp') : t('auth.whatsapp.confirmHintEmail')}</Text>
              </View>
            ) : null}
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
          </Box>
        )}

        {/* Step 2: Personal Information */}
        {step === 2 && (
          <Box>
            <Pressable style={styles.photoCard} onPress={choosePhoto} accessibilityRole="button" accessibilityLabel={t('auth.register.photoTitle')}>
              <View style={styles.photoCircle}>
                {photo ? <Image source={{ uri: photo.uri }} style={styles.photoImg} contentFit="cover" /> : <Ionicons name="camera-outline" size={22} color={colors.green} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTitle}>{t('auth.register.photoTitle')}</Text>
                <Text style={styles.photoHint}>{t('auth.register.photoHint')}</Text>
              </View>
            </Pressable>
            <Field label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
            {accountType === 'SELLER' && (
              <Field label={t('auth.middleName')} value={middleName} onChangeText={setMiddleName} autoCapitalize="words" autoComplete="additional-name" />
            )}
            <Field label={t('auth.lastName')} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" />
            <Field label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder={t('auth.phonePlaceholder')} />
            <Field label={t('auth.register.backupPhone')} value={backupPhone} onChangeText={setBackupPhone} keyboardType="phone-pad" placeholder={t('common.optional')} />
            <Pressable
              style={[styles.sellCard, alsoSell && styles.sellCardOn]}
              onPress={() => { setAlsoSell((v) => !v); setPolicyAccepted(false) }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: alsoSell }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sellTitle}>{t('auth.register.alsoSell')}</Text>
                <Text style={styles.photoHint}>{t('auth.register.alsoSellHint')}</Text>
              </View>
              <View style={[styles.checkbox, alsoSell && styles.checkboxChecked]}>
                {alsoSell ? <Ionicons name="checkmark" size={15} color={colors.onGreen} /> : null}
              </View>
            </Pressable>
            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <Button title={`← ${t('auth.register.back')}`} variant="outline" onPress={prevStep} />
              </View>
              <View style={styles.btnCol}>
                <Button title={`${t('auth.register.next')} →`} onPress={nextStep} />
              </View>
            </View>
          </Box>
        )}

        {/* Step 3: Address & Location */}
        {step === 3 && (
          <Box>
            <StructuredAddressFields value={address} onChange={setAddress} />
            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <Button title={`← ${t('auth.register.back')}`} variant="outline" onPress={prevStep} />
              </View>
              <View style={styles.btnCol}>
                <Button title={`${t('auth.register.next')} →`} onPress={nextStep} />
              </View>
            </View>
          </Box>
        )}

        {/* Step 4: Review / Confirmation */}
        {step === 4 && (
          <Box>
            <Text style={styles.reviewHeading}>{t('auth.register.reviewTitle')}</Text>
            <Text style={styles.muted}>{t('auth.register.reviewSubtitle')}</Text>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.accountDetails')}</Text>
              <Text style={styles.summaryVal}>{email}</Text>
              <Text style={styles.summaryVal}>{accountType === 'SELLER' ? t('auth.register.sellerAccount') : t('auth.register.buyerAccount')}</Text>
              {whatsappEnabled ? <Text style={styles.summaryVal}>{t('auth.whatsapp.confirmWith')} : {useWhatsApp ? `WhatsApp (${phone})` : t('auth.email')}</Text> : null}
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.personalDetails')}</Text>
              <Text style={styles.summaryVal}>{[firstName, middleName, lastName].filter(Boolean).join(' ')}</Text>
              <Text style={styles.summaryVal}>{phone}</Text>
              {backupPhone ? <Text style={styles.summaryVal}>{backupPhone} ({t('auth.register.backupPhone')})</Text> : null}
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{t('auth.register.addressDetails')}</Text>
              <Text style={styles.summaryVal}>{[address.building_number, address.street, address.commune, address.city, address.province].filter(Boolean).join(', ')}</Text>
              {address.landmark ? <Text style={styles.summaryVal}>{address.landmark}</Text> : null}
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
          </Box>
        )}

        <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/login')}>
          <Text style={styles.link}>{t('auth.register.alreadyRegistered')} {t('common.signIn')}</Text>
        </Pressable>
  </>

  const policyModal = (
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
  )

  if (wide) {
    return <>
      <AuthWideShell title={title} subtitle={subtitle} width={520}>{steps}</AuthWideShell>
      {policyModal}
    </>
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <SectionTitle title={title} />
        <Text style={styles.muted}>{subtitle}</Text>

        {steps}
      </ScrollView>

      {policyModal}
    </KeyboardAvoidingView>
  )
}

function FlatBox({ children }: { children?: ReactNode }) {
  return <View style={flatBoxStyle.box}>{children}</View>
}

const flatBoxStyle = StyleSheet.create({ box: { gap: 12 } })

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  rule: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  success: { color: colors.success, fontWeight: '700', fontSize: 13, lineHeight: 21 },
  error: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm, fontSize: 14 },
  link: { color: colors.green, fontWeight: '700', fontSize: 13, textAlign: 'center', marginVertical: spacing.sm },
  // Kicker-style pill naming the flow (buyer / seller).
  flowBanner: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  flowBannerWide: { alignSelf: 'center' },
  buyerBanner: { backgroundColor: colors.greenSoft },
  sellerBanner: { backgroundColor: colors.goldSoft },
  flowBannerText: { ...kicker, color: colors.green },
  // Reference 15: segmented blue progress bar.
  progress: { flexDirection: 'row', gap: 6, marginTop: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressSegOn: { backgroundColor: colors.green },
  stepsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  stepBadgeActive: { backgroundColor: colors.green, borderColor: colors.green },
  stepBadgeDone: { backgroundColor: colors.greenSoft, borderColor: colors.greenSoft },
  stepBadgeText: { fontSize: 11.5, fontWeight: '700', color: colors.muted },
  stepBadgeTextActive: { color: colors.onGreen },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  btnCol: { flex: 1 },
  reviewHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, color: colors.ink },
  summaryBlock: { padding: 12, backgroundColor: colors.surface2, borderRadius: radius.sm, gap: 3 },
  summaryLabel: { ...kicker, color: colors.green, marginBottom: 2 },
  summaryVal: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.xs, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  checkboxMark: { color: colors.onGreen, fontSize: 13, fontWeight: '700' },
  policyText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  policyLink: { color: colors.green, fontWeight: '700' },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  photoCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.green, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  photoHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sellCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  sellCardOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  sellTitle: { color: colors.green, fontSize: 14, fontWeight: '700' },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalBody: { padding: spacing.md, paddingBottom: spacing.xl },
})
