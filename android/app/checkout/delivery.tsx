import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FC`

export default function DeliveryScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { orderId } = useLocalSearchParams<{ orderId?: string }>()
  const user = useAuth((state) => state.user)
  const { t } = useI18n()

  const [usePoints, setUsePoints] = useState(false)
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [contact, setContact] = useState({
    contact_name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    phone: user?.phone ?? '',
    address: '',
    notes: '',
  })

  const profileQuery = useQuery({
    queryKey: ['buyer', 'profile'],
    queryFn: buyerApi.profile,
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (!profileQuery.data && !user) return
    const p = profileQuery.data
    const name = [p?.first_name || user?.first_name, p?.last_name || user?.last_name].filter(Boolean).join(' ')
    const phone = p?.phone || user?.phone || ''
    const fullAddress = [p?.address, p?.commune, p?.city].filter(Boolean).join(', ')
    setContact((prev) => ({
      contact_name: prev.contact_name || name,
      phone: prev.phone || phone,
      address: prev.address || fullAddress,
      notes: prev.notes,
    }))
  }, [profileQuery.data, user])

  const options = useQuery({
    queryKey: ['checkout', 'delivery-options', orderId],
    queryFn: () => buyerApi.deliveryOptions(orderId!),
    enabled: Boolean(orderId),
  })

  const option = options.data?.options?.[0]
  const baseFee = option?.fee ?? 0
  const displayedFee = previewFee !== null ? previewFee : baseFee

  const formInvalid =
    !contact.contact_name.trim() ||
    !contact.phone.trim() ||
    !contact.address.trim()

  const pointsMutation = useMutation({
    mutationFn: (next: boolean) => buyerApi.deliveryPointsPreview(orderId!, next),
    onSuccess: (data) => setPreviewFee(data.fee_final),
    onError: () => setPreviewFee(null),
  })

  const selectMutation = useMutation({
    mutationFn: () =>
      buyerApi.selectDelivery(orderId!, {
        method: 'TBK_STANDARD',
        use_points_for_delivery: usePoints,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        notes: contact.notes.trim(),
      }),
    onSuccess: () => router.push({ pathname: '/checkout/payment', params: { orderId } }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || t('checkout.deliverySaveFailed')
      setError(msg)
    },
  })

  function togglePoints() {
    const next = !usePoints
    setUsePoints(next)
    if (orderId) pointsMutation.mutate(next)
  }

  function submit() {
    if (formInvalid) {
      setError(t('checkout.fillDetails'))
      return
    }
    setError('')
    selectMutation.mutate()
  }

  if (!orderId) return <ErrorState message={t('checkout.orderNotFound')} retry={() => router.replace('/(buyer)/cart')} />
  if (options.isLoading) return <Loading label={t('checkout.loadingOptions')} />
  if (options.isError || !options.data) {
    return <ErrorState message={t('checkout.optionsFailed')} retry={() => options.refetch()} />
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.steps}>
          <Text style={styles.stepDone}>1 {t('tabs.cart')}</Text>
          <Text style={styles.stepActive}>2 {t('checkout.delivery')}</Text>
          <Text style={styles.stepNext}>3 {t('checkout.payment')}</Text>
        </View>

        <SectionTitle title={t('checkout.deliveryMethod')} />

        <Card>
          <View style={styles.tbkHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={24} color={colors.green} />
            </View>
            <View style={styles.tbkHeaderText}>
              <Text style={styles.tbkTitle}>{t('checkout.tbkDeliveryTitle')}</Text>
              <Text style={styles.tbkSubtitle}>{t('checkout.tbkDeliverySubtitle')}</Text>
            </View>
          </View>
          <View style={styles.tbkDivider} />
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>{t('checkout.tbkDeliveryNotice')}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
            <Text style={styles.optionTitle}>{t('checkout.delivery')}</Text>
            <Text style={styles.fee}>{money(displayedFee)}</Text>
          </View>
        </Card>

        {baseFee > 0 ? (
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{t('checkout.payDeliveryWithPoints')}</Text>
                <Text style={styles.muted}>{t('checkout.usePointsHint')}</Text>
              </View>
              <Button
                variant={usePoints ? 'primary' : 'outline'}
                title={usePoints ? t('cart.pointsEnabled') : t('cart.pointsEnable')}
                onPress={togglePoints}
              />
            </View>
            {usePoints && previewFee !== null ? (
              <Text style={[styles.pointsNote, { marginTop: spacing.xs }]}>
                {t('checkout.deliveryFee', { from: money(baseFee), to: money(previewFee) })}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Text style={styles.optionTitle}>{t('checkout.contactDetails')}</Text>
          <Field
            label={t('checkout.contactName')}
            value={contact.contact_name}
            onChangeText={(v) => setContact({ ...contact, contact_name: v })}
          />
          <Field
            label={t('editProfile.phone')}
            value={contact.phone}
            keyboardType="phone-pad"
            onChangeText={(v) => setContact({ ...contact, phone: v })}
          />
          <Field
            label={t('checkout.address')}
            value={contact.address}
            placeholder={t('checkout.addressPlaceholder')}
            onChangeText={(v) => setContact({ ...contact, address: v })}
          />
          <Field
            label={t('checkout.instructions')}
            value={contact.notes}
            multiline
            onChangeText={(v) => setContact({ ...contact, notes: v })}
          />
        </Card>

        {error ? <ErrorState message={error} /> : null}

        <Button
          title={t('checkout.continueToPayment')}
          loading={selectMutation.isPending}
          disabled={formInvalid}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stepDone: { color: colors.green, fontWeight: '800', fontSize: 12 },
  stepActive: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  stepNext: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  tbkHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbkHeaderText: { flex: 1 },
  tbkTitle: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  tbkSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  tbkDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  tbkNotice: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  optionTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  fee: { color: colors.green, fontWeight: '900', fontSize: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pointsNote: { color: colors.success, fontWeight: '700' },
})