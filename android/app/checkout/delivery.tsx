import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { colors, radius, spacing } from '../../src/theme'
import type { DeliveryMethod } from '../../src/types'

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FC`

const METHOD_LABEL: Record<string, TranslationKey> = {
  PICKUP: 'checkout.methodPickup',
  SHOP_DELIVERY: 'checkout.methodShopDelivery',
  PARTNER: 'checkout.methodPartner',
}
const METHOD_HINT: Record<string, TranslationKey> = {
  PICKUP: 'checkout.methodPickupHint',
  SHOP_DELIVERY: 'checkout.methodShopDeliveryHint',
  PARTNER: 'checkout.methodPartnerHint',
}

export default function DeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>()
  const user = useAuth((state) => state.user)
  const { t } = useI18n()

  const [method, setMethod] = useState<DeliveryMethod>('PICKUP')
  const [usePoints, setUsePoints] = useState(false)
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [contact, setContact] = useState({
    contact_name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    phone: user?.phone ?? '',
    address: '',
    notes: '',
  })

  const options = useQuery({
    queryKey: ['checkout', 'delivery-options', orderId],
    queryFn: () => buyerApi.deliveryOptions(orderId!),
    enabled: Boolean(orderId),
  })

  // Start on whichever method the order already carries.
  useEffect(() => {
    const current = options.data?.options.find((o) => o.method === options.data?.current_method)
    if (current?.available) setMethod(current.method)
  }, [options.data])

  const selected = useMemo(
    () => options.data?.options.find((o) => o.method === method) ?? null,
    [options.data, method]
  )

  const needsAddress = method !== 'PICKUP'
  const formInvalid =
    needsAddress &&
    (!contact.contact_name.trim() || !contact.phone.trim() || !contact.address.trim())

  const pointsMutation = useMutation({
    mutationFn: (next: boolean) => buyerApi.deliveryPointsPreview(orderId!, next),
    onSuccess: (data) => setPreviewFee(data.fee_final),
    onError: () => setPreviewFee(null),
  })

  const selectMutation = useMutation({
    mutationFn: () =>
      buyerApi.selectDelivery(orderId!, {
        method,
        use_points_for_delivery: usePoints,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        notes: contact.notes.trim(),
      }),
    onSuccess: () => router.push({ pathname: '/checkout/payment', params: { orderId } }),
    onError: () => setError(t('checkout.deliverySaveFailed')),
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

        {options.data.options.map((option) => {
          const active = method === option.method
          return (
            <Card key={option.method} onPress={option.available ? () => setMethod(option.method) : undefined}>
              <View style={[styles.option, active && styles.optionActive, !option.available && styles.optionOff]}>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={option.available ? colors.green : colors.muted}
                />
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>{METHOD_LABEL[option.method] ? t(METHOD_LABEL[option.method]) : option.label}</Text>
                  <Text style={styles.muted}>{METHOD_HINT[option.method] ? t(METHOD_HINT[option.method]) : ''}</Text>
                  {option.provider ? <Text style={styles.muted}>{t('checkout.providedBy', { provider: option.provider })}</Text> : null}
                </View>
                <Text style={option.available ? styles.fee : styles.muted}>
                  {option.available ? money(option.fee) : t('checkout.unavailable')}
                </Text>
              </View>
            </Card>
          )
        })}

        {selected && selected.fee > 0 ? (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.optionTitle}>{t('checkout.payDeliveryWithPoints')}</Text>
              <Button
                variant={usePoints ? 'primary' : 'outline'}
                title={usePoints ? t('cart.pointsEnabled') : t('cart.pointsEnable')}
                onPress={togglePoints}
              />
            </View>
            {usePoints && previewFee !== null ? (
              <Text style={styles.pointsNote}>
                {t('checkout.deliveryFee', { from: money(selected.fee), to: money(previewFee) })}
              </Text>
            ) : (
              <Text style={styles.muted}>{t('checkout.usePointsHint')}</Text>
            )}
          </Card>
        ) : null}

        {needsAddress ? (
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
        ) : (
          <Card>
            <Text style={styles.muted}>
              {t('checkout.pickupNote')}
            </Text>
          </Card>
        )}

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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stepDone: { color: colors.green, fontWeight: '800', fontSize: 12 },
  stepActive: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  stepNext: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.sm },
  optionActive: {},
  optionOff: { opacity: 0.5 },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 13 },
  fee: { color: colors.green, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pointsNote: { color: colors.success, fontWeight: '700' },
})