import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from '../../src/components/StructuredAddressFields'
import { formatMoney } from '../../src/lib/money'

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

  const options = useQuery({
    queryKey: ['checkout', 'delivery-options', orderId],
    queryFn: () => buyerApi.deliveryOptions(orderId!),
    enabled: Boolean(orderId),
  })

  // Every order of the checkout group has its own delivery fee, priced by the backend.
  const groupOptions = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['checkout', 'delivery-options', id],
      queryFn: () => buyerApi.deliveryOptions(id),
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
            {usePoints && previewFee !== null && !pointsShortForGroup ? (
              <Text style={[styles.pointsNote, { marginTop: spacing.xs }]}>
                {t('checkout.deliveryFee', { from: money(baseFee), to: money(previewFee) })}
              </Text>
            ) : null}
            {usePoints && pointsShortForGroup ? (
              <Text style={[styles.muted, { marginTop: spacing.xs }]}>{t('checkout.pointsSplitAcrossOrders', { points: availablePoints })}</Text>
            ) : null}
            {orderIds.length > 1 ? <Text style={[styles.muted, { marginTop: spacing.xs }]}>{t('checkout.deliveryFeesForOrders', { count: orderIds.length })}</Text> : null}
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
            label={t('checkout.instructions')}
            value={contact.notes}
            multiline
            onChangeText={(v) => setContact({ ...contact, notes: v })}
          />
        </Card>

        <SectionTitle title={t('checkout.delivery')} />

        {mode === 'saved' && savedAddress && (
          <Card>
            <Text style={styles.savedLabel}>Adresse enregistrée</Text>
            <Text style={styles.savedValue}>{savedAddress.street}, {savedAddress.building_number}</Text>
            <Text style={styles.savedValue}>{savedAddress.commune}, {savedAddress.city}</Text>
            <Text style={styles.savedValue}>{savedAddress.province}</Text>
            {savedAddress.landmark ? <Text style={[styles.savedValue, { marginTop: 4 }]}>Repère : {savedAddress.landmark}</Text> : null}
            <Button title="Utiliser cette adresse" onPress={submit} loading={selectMutation.isPending} />
            <TouchableOpacity onPress={() => { setError(''); setMode('custom') }}>
              <Text style={styles.customLink}>Utiliser une autre adresse</Text>
            </TouchableOpacity>
          </Card>
        )}

        {mode === 'custom' && (
          <Card>
            <StructuredAddressFields value={address} onChange={setAddress} />
            <TouchableOpacity style={styles.checkbox} onPress={() => setSavePrimary(!savePrimary)}>
              <View style={[styles.checkboxTick, savePrimary && styles.checkboxTickOn]}>
                {savePrimary ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkboxLabel}>Enregistrer comme adresse principale</Text>
                <Text style={styles.checkboxHint}>Elle sera réutilisée et pré-remplie lors de vos prochaines commandes.</Text>
              </View>
            </TouchableOpacity>
            {savedAddress && (
              <TouchableOpacity onPress={() => { setError(''); setMode('saved') }}>
                <Text style={styles.customLink}>Revenir à l'adresse enregistrée</Text>
              </TouchableOpacity>
            )}
            <Button title={t('checkout.continueToPayment')} loading={selectMutation.isPending} disabled={formInvalid} onPress={submit} />
          </Card>
        )}

        {error ? <ErrorState message={error} /> : null}
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  tbkHeaderText: { flex: 1 },
  tbkTitle: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  tbkSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  tbkDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  optionTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  fee: { color: colors.green, fontWeight: '900', fontSize: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pointsNote: { color: colors.success, fontWeight: '700' },
  savedLabel: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  savedValue: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  customLink: { textAlign: 'center', color: colors.success, fontWeight: '700', fontSize: 14, marginTop: 12, textDecorationLine: 'underline' },
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12, marginTop: 10 },
  checkboxTick: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxTickOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkboxLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  checkboxHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
})