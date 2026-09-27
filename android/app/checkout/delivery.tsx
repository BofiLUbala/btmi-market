import { useEffect, useMemo, useState } from 'react'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, type Colors } from '../../src/theme'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from '../../src/components/StructuredAddressFields'
import { formatMoney } from '../../src/lib/money'
import { CheckoutProgress } from '../../src/components/CheckoutProgress'
import { AddressSummary, CardHead, CheckoutCard, CheckoutHeading, Divider, Eyebrow, H2, OptionCard, SmallText, ToggleSwitch, UnderlineLink, checkoutPage } from '../../src/components/CheckoutUI'
import type { TranslationKey } from '../../src/locales/fr'

const money = (value: number, currency?: string) => formatMoney(value, currency)

function savedAddressFromProfile(profile: any): StructuredAddressValue | null {
  if (!profile) return null
  const v: StructuredAddressValue = {
    province: profile.province ?? '', city: profile.city ?? '', commune: profile.commune ?? '',
    province_id: profile.province_id ?? '', city_id: profile.city_id ?? '', commune_id: profile.commune_id ?? '',
    street: profile.street || profile.address || '', building_number: profile.building_number ?? '', landmark: profile.landmark ?? '',
  }
  return isStructuredAddressComplete(v) ? v : null
}

export default function DeliveryScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { orderId, orderIds: orderIdsParam, checkoutGroupId } = useLocalSearchParams<{ orderId?: string; orderIds?: string; checkoutGroupId?: string }>()
  // A multi-shop checkout is one order per shop; the buyer chooses delivery once.
  const orderIds = useMemo(() => {
    const ids = (orderIdsParam || '').split(',').filter(Boolean)
    return ids.length ? ids : orderId ? [orderId] : []
  }, [orderIdsParam, orderId])
  const user = useAuth((state) => state.user)
  const { t } = useI18n()

  const [usePoints, setUsePoints] = useState(false)
  const [error, setError] = useState('')
  const [contact, setContact] = useState({
    contact_name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    phone: user?.phone ?? '',
    notes: '',
  })

  const profileQuery = useQuery({
    queryKey: ['buyer', 'profile'],
    queryFn: buyerApi.profile,
    enabled: Boolean(user),
  })

  const savedAddress = useMemo(() => savedAddressFromProfile(profileQuery.data), [profileQuery.data])

  const [address, setAddress] = useState<StructuredAddressValue>(() => savedAddressFromProfile(profileQuery.data) ?? emptyStructuredAddress())
  const [mode, setMode] = useState<'saved' | 'custom'>(() => (savedAddress ? 'saved' : 'custom'))
  // First checkout: store the address as primary by default. Returning buyer
  // editing their address: opt-in, so a temporary address stays temporary.
  const [savePrimary, setSavePrimary] = useState(() => !savedAddress)

  useEffect(() => {
    if (!profileQuery.data && !user) return
    const p = profileQuery.data
    const name = [p?.first_name || user?.first_name, p?.last_name || user?.last_name].filter(Boolean).join(' ')
    const phone = p?.phone || user?.phone || ''
    setContact((prev) => ({
      contact_name: prev.contact_name || name,
      phone: prev.phone || phone,
      notes: prev.notes,
    }))
  }, [profileQuery.data, user])

  // The fee must track the city the buyer is actually entering — otherwise it's
  // stuck on the platform default and can silently differ from what
  // selectDelivery charges once the real city is submitted.
  const effectiveCityId = mode === 'saved' ? savedAddress?.city_id || '' : address.city_id || ''

  const options = useQuery({
    queryKey: ['checkout', 'delivery-options', orderId, effectiveCityId],
    queryFn: () => buyerApi.deliveryOptions(orderId!, effectiveCityId || undefined),
    enabled: Boolean(orderId),
  })

  // Every order of the checkout group has its own delivery fee, priced by the backend.
  const groupOptions = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['checkout', 'delivery-options', id, effectiveCityId],
      queryFn: () => buyerApi.deliveryOptions(id, effectiveCityId || undefined),
    })),
  })
  const baseFee = groupOptions.reduce((sum, q) => sum + (q.data?.options?.[0]?.fee ?? 0), 0)

  // Points preview for each order, straight from the backend rule. Nothing is recomputed here.
  const pointsPreviews = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['checkout', 'delivery-points-preview', id],
      queryFn: () => buyerApi.deliveryPointsPreview(id, true),
      enabled: usePoints,
      retry: false,
    })),
  })
  const previewsReady = usePoints && pointsPreviews.length > 0 && pointsPreviews.every((q) => q.data)
  const previewFee = previewsReady ? pointsPreviews.reduce((sum, q) => sum + q.data!.fee_final, 0) : null
  const previewPointsUsed = previewsReady ? pointsPreviews.reduce((sum, q) => sum + q.data!.points_used, 0) : 0
  const availablePoints = pointsPreviews.find((q) => q.data)?.data?.available_points ?? 0
  // Each preview is priced against the full balance, while confirming reserves points
  // order by order. When the group needs more points than the buyer has, the summed
  // preview is not what will be charged: say so rather than show a wrong total. The
  // payment step shows the backend's per-order amounts after reservation.
  const pointsShortForGroup = orderIds.length > 1 && previewsReady && previewPointsUsed > availablePoints
  const displayedFee = previewFee !== null && !pointsShortForGroup ? previewFee : baseFee

  const formInvalid = !contact.contact_name.trim() || !contact.phone.trim() ||
    (mode === 'custom' && !isStructuredAddressComplete(address))

  const selectMutation = useMutation({
    mutationFn: async () => {
      const body = (saveAddress: boolean) => ({
        method: 'TBK_STANDARD',
        use_points_for_delivery: usePoints,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: [address.street.trim(), address.building_number.trim(), address.commune, address.city, address.province].filter(Boolean).join(', '),
        province_id: address.province_id, city_id: address.city_id, commune_id: address.commune_id,
        province: address.province, city: address.city, commune: address.commune,
        street: address.street.trim(), building_number: address.building_number.trim(), landmark: address.landmark.trim(),
        notes: contact.notes.trim(),
        save_address: saveAddress,
      })
      const first = await buyerApi.selectDelivery(orderId!, body(mode === 'saved' ? false : savePrimary))
      // The other orders of the group get the same address, applied by the same endpoint.
      for (const siblingId of orderIds.filter((id) => id !== orderId)) {
        await buyerApi.selectDelivery(siblingId, body(false))
      }
      return first
    },
    onSuccess: () => router.push({ pathname: '/checkout/payment', params: { orderId, orderIds: orderIds.join(','), ...(checkoutGroupId ? { checkoutGroupId } : {}) } }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || t('checkout.deliverySaveFailed')
      setError(msg)
    },
  })

  function togglePoints() {
    setUsePoints(!usePoints)
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

  const w = (key: string, vars?: Record<string, string | number>) => t(`web.${key}` as TranslationKey, vars)

  // Same sections, order and wording as web-app/src/pages/checkout/DeliveryPage.tsx.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <KeyboardAwareScrollView contentContainerStyle={checkoutPage} keyboardShouldPersistTaps="handled">
        <CheckoutProgress current="delivery" />
        <CheckoutHeading title={w('delivery.title')} subtitle={w('delivery.subtitle')} />

        <CheckoutCard>
          <CardHead title={w('delivery.tbkTitle')} />
          <OptionCard title={w('delivery.tbkTitle')} amount={money(displayedFee)} lines={[w('delivery.tbkSubtitle'), w('delivery.tbkNotice')]} />
          {orderIds.length > 1 ? <SmallText>{t('checkout.deliveryFeesForOrders', { count: orderIds.length })}</SmallText> : null}
        </CheckoutCard>

        {baseFee > 0 ? (
          <CheckoutCard tone={usePoints ? 'rewardsOn' : 'rewards'}>
            <View style={{ flex: 1, gap: 4 }}>
              <Eyebrow>{w('delivery.rewards')}</Eyebrow>
              <Text style={styles.rewardsTitle}>{w('delivery.usePointsForDelivery')}</Text>
              <SmallText>{w('delivery.reduceFee')}</SmallText>
            </View>
            <ToggleSwitch on={usePoints} onPress={togglePoints} label={w('delivery.usePointsForDelivery')} />
            {usePoints && previewFee !== null && !pointsShortForGroup ? (
              <Text style={styles.pointsNote}>{w('points.applied')} · {w('delivery.fee')} {money(baseFee)} → {money(previewFee)}</Text>
            ) : null}
            {usePoints && pointsShortForGroup ? (
              <SmallText>{t('checkout.pointsSplitAcrossOrders', { points: availablePoints })}</SmallText>
            ) : null}
          </CheckoutCard>
        ) : null}

        <CheckoutCard>
          <Eyebrow>{w('delivery.details')}</Eyebrow>
          <H2>{w('delivery.contactName')}</H2>
          <Field label={w('delivery.contactName')} value={contact.contact_name} onChangeText={(v) => setContact({ ...contact, contact_name: v })} />
          <Field label={w('common.phone')} value={contact.phone} keyboardType="phone-pad" onChangeText={(v) => setContact({ ...contact, phone: v })} />
          <Field label={w('delivery.notes')} value={contact.notes} onChangeText={(v) => setContact({ ...contact, notes: v })} />

          <Divider />
          <Eyebrow>{w('delivery.savedAddressTitle')}</Eyebrow>

          {mode === 'saved' && savedAddress ? (
            <>
              <SmallText>{w('delivery.savedAddress')}</SmallText>
              <AddressSummary value={savedAddress} />
              <Button title={w('delivery.useSavedAddress')} onPress={submit} loading={selectMutation.isPending} />
              <UnderlineLink title={w('delivery.useAnotherAddress')} onPress={() => { setError(''); setMode('custom') }} />
            </>
          ) : null}

          {mode === 'custom' ? (
            <>
              <StructuredAddressFields value={address} onChange={setAddress} />
              {isStructuredAddressComplete(address) ? <AddressSummary value={address} /> : <SmallText>{w('delivery.addressIncomplete')}</SmallText>}
              <TouchableOpacity style={styles.checkbox} onPress={() => setSavePrimary(!savePrimary)} accessibilityRole="checkbox" accessibilityState={{ checked: savePrimary }}>
                <View style={[styles.checkboxTick, savePrimary && styles.checkboxTickOn]}>
                  {savePrimary ? <Ionicons name="checkmark" size={14} color={colors.onGreen} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkboxLabel}>{w('delivery.saveAsPrimary')}</Text>
                  <Text style={styles.checkboxHint}>{w('delivery.saveAsPrimaryHint')}</Text>
                </View>
              </TouchableOpacity>
              <SmallText>{w('delivery.otherAddressNote')}</SmallText>
              {savedAddress ? <UnderlineLink title={w('delivery.backToSavedAddress')} onPress={() => { setError(''); setMode('saved') }} /> : null}
              <Button title={w('delivery.continueToReview')} loading={selectMutation.isPending} disabled={formInvalid} onPress={submit} />
            </>
          ) : null}
        </CheckoutCard>

        {error ? <ErrorState message={error} /> : null}
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  rewardsTitle: { color: colors.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 17 },
  pointsNote: { width: '100%', color: colors.success, fontSize: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  // web .checkout-checkbox
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  checkboxTick: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxTickOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkboxLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  checkboxHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
})
