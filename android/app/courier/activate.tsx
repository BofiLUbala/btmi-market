import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete } from '../../src/components/StructuredAddressFields'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/**
 * Courier accounts exist by invitation only: this screen spends the emailed
 * token, sets the password and records where the courier picks packages up.
 *
 * The file is a static route on purpose. `/courier/activate` used to be
 * swallowed by `/courier/[id]`, which read "activate" as a delivery id and
 * left the invited courier on an "Order details" screen retrying forever;
 * a static segment wins over a dynamic one, so that cannot happen again.
 */
export default function CourierActivateScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [address, setAddress] = useState(emptyStructuredAddress())

  // Shows whose invitation this is before anything is typed, and tells an
  // expired or already-used link apart from a wrong password.
  const invitation = useQuery({
    queryKey: ['courier', 'invitation', token],
    queryFn: () => courierApi.verifyInvitation(token),
    enabled: Boolean(token),
    retry: false,
  })

  const rules = useMemo(
    () => [password.length >= 8, password.length <= 64, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)],
    [password]
  )
  const ruleLabels = useMemo(
    () => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')],
    [t]
  )
  const matches = confirmation.length > 0 && password === confirmation
  const addressComplete = isStructuredAddressComplete(address)
  const valid = Boolean(token) && rules.every(Boolean) && matches && addressComplete

  const activate = useMutation({
    mutationFn: () => courierApi.activateInvitation({
      token,
      password,
      password_confirmation: confirmation,
      province: address.province,
      city: address.city,
      commune: address.commune,
      street: address.street,
      building_number: address.building_number,
      landmark: address.landmark,
    }),
  })

  if (!token) {
    return (
      <View style={styles.page}>
        <SectionTitle title={t('courierActivation.invalidLinkTitle')} />
        <ErrorState message={t('courierActivation.invalidLinkBody')} retry={() => router.replace('/auth/login')} actionLabel={t('common.signIn')} />
      </View>
    )
  }

  if (invitation.isLoading) return <View style={styles.page}><Loading label={t('common.loading')} /></View>

  if (invitation.isError) {
    return (
      <View style={styles.page}>
        <SectionTitle title={t('courierActivation.invalidLinkTitle')} />
        <ErrorState message={t('courierActivation.invalidLinkBody')} retry={() => router.replace('/auth/login')} actionLabel={t('common.signIn')} />
      </View>
    )
  }

  if (activate.isSuccess) {
    return (
      <View style={styles.page}>
        <SectionTitle title={t('courierActivation.successTitle')} />
        <Card>
          <Text style={styles.body}>{t('courierActivation.successBody')}</Text>
          <Button title={t('courierActivation.goToSpace')} onPress={() => router.replace('/auth/login')} />
        </Card>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.mark}>🛵</Text>
      <SectionTitle title={t('courierActivation.title')} />
      <Text style={styles.body}>{t('courierActivation.subtitle')}</Text>

      <Card>
        <Field label={t('auth.firstName')} value={invitation.data?.first_name ?? ''} onChangeText={() => {}} editable={false} />
        <Field label={t('auth.lastName')} value={invitation.data?.last_name ?? ''} onChangeText={() => {}} editable={false} />
        <Field label={t('common.email')} value={invitation.data?.email ?? ''} onChangeText={() => {}} editable={false} />
        <Field label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry maxLength={64} />
        <View>{ruleLabels.map((label, index) => <Text key={label} style={[styles.rule, rules[index] && styles.met]}>{rules[index] ? '✓' : '○'} {label}</Text>)}</View>
        <Field label={t('courierActivation.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={64} />
        {confirmation.length > 0 && <Text style={matches ? styles.met : styles.error}>{matches ? t('auth.passwordsMatch') : t('courierActivation.passwordsMismatch')}</Text>}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('courierActivation.addressTitle')}</Text>
        <Text style={styles.body}>{t('courierActivation.addressHint')}</Text>
        <StructuredAddressFields value={address} onChange={setAddress} />
        {!addressComplete && <Text style={styles.rule}>{t('courierActivation.addressIncomplete')}</Text>}
      </Card>

      <Button title={activate.isPending ? t('courierActivation.activating') : t('courierActivation.submit')} loading={activate.isPending} disabled={!valid} onPress={() => activate.mutate()} />
      {activate.isError && <Text style={styles.error}>{activate.error instanceof ApiError ? activate.error.message : t('courierActivation.failed')}</Text>}
    </ScrollView>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.cream },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
    mark: { fontSize: 40, textAlign: 'center' },
    sectionTitle: { color: c.ink, fontSize: 16, fontWeight: '700' },
    body: { color: c.muted, fontSize: 14 },
    rule: { color: c.muted, fontSize: 13 },
    met: { color: c.success, fontSize: 13, fontWeight: '700' },
    error: { color: c.danger, fontSize: 13, fontWeight: '700' },
  })
