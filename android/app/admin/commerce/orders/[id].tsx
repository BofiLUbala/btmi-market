import { useMemo, useState, useEffect, useCallback } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { adminCommerceApi, type AdminCourierListItem, type AdminOrderDetail, type AdminOrderItem } from '../../../../src/api/admin'
import { useI18n, type TranslationKey } from '../../../../src/store/i18n'
import { formatMoney } from '../../../../src/lib/money'
import { deliveryLabel } from '../../../../src/lib/deliveryLabels'

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#fbbf24',
  ACCEPTED: '#60a5fa',
  PREPARING: '#c084fc',
  READY: '#34d399',
  READY_FOR_PICKUP: '#34d399',
  PICKED_UP: '#38bdf8',
  IN_TRANSIT: '#38bdf8',
  COURIER_ARRIVED: '#38bdf8',
  DELIVERY_SCAN_SUCCESS: '#34d399',
  AWAITING_BUYER_CONFIRMATION: '#34d399',
  OUT_FOR_DELIVERY: '#38bdf8',
  DELIVERED: '#34d399',
  RECEIVED: '#34d399',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
  REJECTED: '#f97316',
  FAILED: '#ef4444',
  COURIER_REJECTED: '#f97316',
  PENDING_TBK_ASSIGNMENT: '#fbbf24',
  COURIER_ASSIGNED: '#60a5fa',
  PROCESSING: '#fbbf24',
  PAID: '#10b981',
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  PENDING: 'status.pending',
  ACCEPTED: 'status.accepted',
  PREPARING: 'status.preparing',
  READY: 'status.ready',
  READY_FOR_PICKUP: 'status.readyForPickup',
  PICKED_UP: 'delivery.status.PICKED_UP',
  IN_TRANSIT: 'delivery.status.IN_TRANSIT',
  COURIER_ARRIVED: 'delivery.status.COURIER_ARRIVED',
  DELIVERY_SCAN_SUCCESS: 'delivery.status.DELIVERY_SCAN_SUCCESS',
  AWAITING_BUYER_CONFIRMATION: 'delivery.status.AWAITING_BUYER_CONFIRMATION',
  OUT_FOR_DELIVERY: 'status.outForDelivery',
  DELIVERED: 'status.delivered',
  RECEIVED: 'status.received',
  COMPLETED: 'status.completed',
  CANCELLED: 'status.cancelled',
  REJECTED: 'status.rejected',
  FAILED: 'delivery.status.FAILED',
  COURIER_REJECTED: 'delivery.status.COURIER_REJECTED',
  PENDING_TBK_ASSIGNMENT: 'delivery.status.PENDING_TBK_ASSIGNMENT',
  COURIER_ASSIGNED: 'delivery.status.COURIER_ASSIGNED',
  PROCESSING: 'status.processing',
  PAID: 'status.paid',
}

function statusLabel(t: (key: TranslationKey, vars?: Record<string, string | number>) => string, status: string): string {
  const known = STATUS_KEYS[status]
  if (known) return t(known)
  return status.replace(/_/g, ' ')
}

function Badge({ status }: { status: string }) {
  const { t } = useI18n()
  const color = STATUS_COLORS[status] || '#94a3b8'
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{statusLabel(t, status)}</Text>
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export default function AdminOrderDetailScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [showAssign, setShowAssign] = useState(false)
  const [couriers, setCouriers] = useState<AdminCourierListItem[]>([])
  const [courierId, setCourierId] = useState('')
  const [courierNotes, setCourierNotes] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const paidLabel = statusLabel(t, detail?.order.payment_status || '')

  const load = useCallback((background = false) => {
    if (!id) return
    if (!background) setLoading(true)
    adminCommerceApi.getOrder(id)
      .then((res) => setDetail(res))
      .catch((e) => { if (!background) setLoadError(e?.message || t('admin.orders.loadFailed')) })
      .finally(() => { if (!background) setLoading(false) })
  }, [id, t])

  useEffect(() => { load() }, [load])

  // The courier can settle a cash payment while this is open, so refresh quietly.
  useEffect(() => {
    const timer = setInterval(() => load(true), 30_000)
    return () => clearInterval(timer)
  }, [load])

  const openAssign = () => {
    setAssignError('')
    setShowAssign(true)
    if (couriers.length === 0) {
      adminCommerceApi.listAvailableCouriers()
        .then((list) => setCouriers(list || []))
        .catch((e) => setAssignError(e?.message || t('admin.orders.assignCourierFailed')))
    }
  }

  async function handleAssignCourier() {
    if (!id || !courierId) return
    setAssigning(true)
    setAssignError('')
    try {
      await adminCommerceApi.assignCourier(id, {
        courier_id: courierId,
        notes: courierNotes.trim() || undefined,
      })
      const refreshed = await adminCommerceApi.getOrder(id)
      setDetail(refreshed)
      setShowAssign(false)
      setCourierId('')
      setCourierNotes('')
    } catch (e: any) {
      setAssignError(e?.message || t('admin.orders.assignCourierFailed'))
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#10b981" /><Text style={styles.loadingText}>{t('admin.orders.loadingDetail')}</Text></View>
  }
  if (!detail) {
    return <View style={styles.center}><Text style={styles.errorText}>{loadError || t('admin.orders.notFound')}</Text></View>
  }

  const o: AdminOrderItem = detail.order
  const assignable = o.delivery_status === 'COURIER_REJECTED' || o.delivery_status === 'FAILED' || !['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(o.delivery_status || '')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>← {t('admin.orders.backToList')}</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>{t('admin.orders.detailTitle', { number: o.order_number })}</Text>
        <Text style={styles.muted}>{t('admin.orders.placedAt', { date: new Date(o.created_at).toLocaleString() })}</Text>
        <View style={styles.badgeRow}>
          <Badge status={o.status} />
          {o.delivery_status ? <Badge status={o.delivery_status} /> : null}
          <Badge status={o.payment_status} />
        </View>
      </View>

      <Section title={t('admin.orders.summaryTitle')}>
        <Field label={t('admin.orders.fieldOrderNumber')} value={o.order_number} />
        <Field label={t('common.total')} value={formatMoney(o.final_total, o.currency || 'USD')} />
        <Field label={t('admin.orders.fieldBaseTotal')} value={formatMoney(o.base_total, o.currency || 'USD')} />
        <Field label={t('admin.orders.fieldDeliveryFee')} value={formatMoney(o.delivery_fee, o.currency || 'USD')} />
        <Field label={t('admin.orders.fieldPointsDiscount')} value={o.points_discount > 0 ? `-${formatMoney(o.points_discount, o.currency || 'USD')}` : formatMoney(0, o.currency || 'USD')} />
        <Field label={t('admin.orders.fieldPaymentMethod')} value={o.payment_method || detail.payment?.payment_method || '—'} />
        {o.payment_provider ? <Field label={t('admin.orders.fieldProvider')} value={o.payment_provider.replace(/_/g, ' ')} /> : null}
        <Field label={t('admin.orders.fieldPaymentStatus')} value={paidLabel} />
        {o.payment_reference ? <Field label={t('admin.orders.fieldPaymentReference')} value={o.payment_reference} /> : null}
        {o.seller_name ? <Field label={t('admin.orders.fieldSeller')} value={o.seller_name} /> : null}
        <Field label={t('admin.orders.fieldDeliveryMethod')} value={deliveryLabel(t, o.delivery_method) || 'TBK_STANDARD'} />
        {o.is_stuck ? <Field label={t('admin.orders.fieldStuckReason')} value={o.stuck_reason || t('admin.orders.stuckReasonDefault')} /> : null}
      </Section>

      <Section title={t('admin.orders.deliveryTitle')}>
        <Field label={t('admin.orders.deliveryStatus')} value={statusLabel(t, o.delivery_status || 'PENDING_TBK_ASSIGNMENT')} />
        <Field label={t('admin.orders.deliveryContact')} value={o.delivery_contact_name || o.buyer_name} />
        <Field label={t('admin.orders.deliveryPhone')} value={o.delivery_phone || o.buyer_phone} />
        <Field label={t('admin.orders.deliveryAddress')} value={o.delivery_address || '—'} />
        {o.delivery_notes ? <Field label={t('admin.orders.deliveryCustomerNotes')} value={o.delivery_notes} /> : null}
        {o.assigned_courier_id ? (
          <>
            <Field label={t('admin.orders.assignedCourierId')} value={o.courier_name ? `${o.courier_name} · ${o.assigned_courier_id}` : o.assigned_courier_id} />
            {o.courier_assigned_at ? <Field label={t('admin.orders.assignedAt')} value={new Date(o.courier_assigned_at).toLocaleString()} /> : null}
            {o.courier_notes ? <Field label={t('admin.orders.courierNotes')} value={o.courier_notes} /> : null}
          </>
        ) : null}

        {assignable && (
          <View style={styles.assignBlock}>
            {!showAssign ? (
              <Pressable style={styles.assignBtn} onPress={openAssign}>
                <Text style={styles.assignBtnText}>{o.assigned_courier_id ? t('admin.orders.changeCourier') : t('admin.orders.assignCourier')}</Text>
              </Pressable>
            ) : (
              <View style={styles.assignForm}>
                <Text style={styles.assignFormTitle}>{t('admin.orders.assignCourierFormTitle')}</Text>
                {assignError ? <Text style={styles.errorText}>{assignError}</Text> : null}
                {couriers.length === 0 ? (
                  <Text style={styles.muted}>{t('admin.orders.noCouriersAvailable')}</Text>
                ) : (
                  <View style={styles.courierList}>
                    {couriers.map((c) => (
                      <Pressable key={c.id} style={[styles.courierOption, courierId === c.user_id && styles.courierOptionActive]} onPress={() => setCourierId(c.user_id)}>
                        <Text style={[styles.courierName, courierId === c.user_id && styles.courierNameActive]}>
                          {c.first_name} {c.last_name}
                        </Text>
                        <Text style={styles.muted}>{c.availability} · {c.transport_type}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={styles.input}
                  value={courierNotes}
                  onChangeText={setCourierNotes}
                  placeholder={t('admin.orders.assignNotesPlaceholder')}
                  placeholderTextColor="#64748b"
                />
                <View style={styles.assignActions}>
                  <Pressable style={[styles.confirmBtn, (!courierId || assigning) && styles.disabled]} disabled={!courierId || assigning} onPress={() => void handleAssignCourier()}>
                    <Text style={styles.confirmBtnText}>{assigning ? t('admin.orders.assigning') : t('admin.orders.confirmAssign')}</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => { setShowAssign(false); setAssignError(''); setCourierId(''); setCourierNotes('') }}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </Section>

      <Section title={t('admin.orders.customerTitle')}>
        <Field label={t('common.name')} value={o.buyer_name} />
        <Field label={t('admin.orders.deliveryPhone')} value={o.buyer_phone} />
        <Field label={t('admin.orders.fieldShop')} value={o.shop_name} />
        <Field label={t('admin.orders.fieldBusiness')} value={o.business_name} />
      </Section>

      <Section title={t('admin.orders.itemsTitle')}>
        {detail.lines.map((line) => (
          <View key={line.id} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.product_name}</Text>
              <Text style={styles.muted}>{t('admin.orders.qty', { count: line.quantity })} · {formatMoney(line.final_unit_price, o.currency || 'USD')}</Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title={t('admin.orders.historyTitle')}>
        {detail.status_history.map((h, i) => (
          <View key={h.id || i} style={styles.historyRow}>
            <View style={styles.historyDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{statusLabel(t, h.status)}</Text>
              {h.notes ? <Text style={styles.muted}>{h.notes}</Text> : null}
              <Text style={styles.time}>{h.changed_by || '—'} · {new Date(h.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {detail.status_history.length === 0 ? <Text style={styles.muted}>{t('admin.orders.noHistory')}</Text> : null}
      </Section>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', padding: 24, gap: 12 },
  loadingText: { color: '#64748b', fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  backLink: { marginBottom: 12 },
  backText: { color: '#64748b', fontSize: 13 },
  header: { marginBottom: 16 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  muted: { color: '#94a3b8', fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  section: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 14 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 8 },
  fieldLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  fieldValue: { color: '#f8fafc', fontSize: 14 },
  assignBlock: { marginTop: 12, borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 12 },
  assignBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  assignBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  assignForm: { backgroundColor: '#020617', padding: 12, borderRadius: 8, gap: 10 },
  assignFormTitle: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },
  courierList: { gap: 8 },
  courierOption: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10 },
  courierOptionActive: { borderColor: '#10b981' },
  courierName: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  courierNameActive: { color: '#10b981' },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13, backgroundColor: '#0f172a' },
  assignActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  confirmBtn: { backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  confirmBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  cancelBtnText: { color: '#fff', fontSize: 12 },
  disabled: { opacity: 0.5 },
  lineRow: { borderTopWidth: 1, borderColor: '#1e293b', paddingVertical: 10 },
  lineName: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  time: { color: '#64748b', fontSize: 11 },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 5 },
})