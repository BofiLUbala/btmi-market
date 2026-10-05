import { Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { adminLabel } from '@/lib/adminLabels'
import { Link, useSearchParams } from 'react-router-dom'
import {
  adminCommerceApi,
  type AdminOrderItem,
  type AdminCourierListItem,
  type AdminOrderDetail,
  type AdminDeliveryHandover
} from '@/api/admin'
import { useT } from '@/store/i18n'
import { dateLocale, formatMoney } from '@/lib/format'
import type { TranslationKey } from '@/locales/fr'
import { shouldShowLiveMap } from '@/lib/liveLocation'

// Read-only courier position for an order in transit (Commerce Admin only:
// this page and its API live under /admin/commerce, closed to Finance).
const LiveCourierMap = lazy(() => import('@/components/tracking/LiveCourierMap'))
const RoutePlanner = lazy(() => import('@/components/tracking/RoutePlanner'))
/** Delivery states in which a route can be planned or corrected. */
const ROUTE_PLANNING = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT']

// No courier can be (re)assigned once the order is closed or its parcel is going back.
// Once the parcel has left the shop the courier can no longer be changed (the backend refuses it too).
const CLOSED_DELIVERY = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'COURIER_EN_ROUTE_TO_BUYER', 'COURIER_ARRIVED', 'CANCELLED', 'RETURNING_TO_SELLER', 'RETURNED_TO_SELLER', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED', 'DELIVERED', 'COMPLETED']
const CLOSED_ORDER = ['OUT_FOR_DELIVERY', 'HANDED_TO_PARTNER', 'CANCELLED', 'REJECTED', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const canAssign = (o: AdminOrderItem) =>
  !CLOSED_ORDER.includes(o.status) && !CLOSED_DELIVERY.includes(o.delivery_status || '')

// Every ACTIVE courier can be assigned; availability only orders the list and
// tells the admin whether the courier is currently on shift.
// Code -> translation key; translated at render time.
const AVAILABILITY_LABEL: Record<string, TranslationKey> = { AVAILABLE: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.availAvailable', BUSY: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.availBusy', UNAVAILABLE: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.availUnavailable' } as Record<string, TranslationKey>
const TRANSPORT_LABEL: Record<string, TranslationKey> = { MOTORCYCLE: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportMotorcycle', BICYCLE: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportBicycle', CAR: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportCar', VAN: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportVan', FOOT: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportFoot', TRUCK: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.transportTruck' } as Record<string, TranslationKey>
const SCAN_TYPE_LABEL: Record<string, TranslationKey> = { PICKUP: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.scanPickup', DELIVERY: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.scanDelivery', PRODUCT: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.scanProduct' } as Record<string, TranslationKey>
const SCAN_RESULT_LABEL: Record<string, TranslationKey> = { SUCCESS: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultSuccess', FAILED: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultFailed', INVALID_QR: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultInvalidQr', WRONG_ORDER: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultWrongOrder', ALREADY_USED: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultAlreadyUsed', EXPIRED: 'adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.resultExpired' } as Record<string, TranslationKey>
const ASSIGNED_STATUSES = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'COURIER_EN_ROUTE_TO_SHOP']
const IN_TRANSIT_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'COURIER_EN_ROUTE_TO_BUYER', 'COURIER_ARRIVED']

/** Every order, page by page: the dispatch KPIs and filters must not stop at the first 100. */
async function loadAllOrders() {
  const PAGE = 100
  const first = await adminCommerceApi.listOrders({ limit: PAGE })
  const all = [...(first.orders || [])]
  for (let offset = PAGE; offset < Math.min(first.total, 2000); offset += PAGE) {
    const next = await adminCommerceApi.listOrders({ limit: PAGE, offset })
    all.push(...(next.orders || []))
  }
  return all
}

const AVAILABILITY_ORDER: Record<string, number> = { AVAILABLE: 0, BUSY: 1, UNAVAILABLE: 2 }

type DeliveryStatusFilter = 'ALL' | 'READY_FOR_PICKUP' | 'COURIER_ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'RECEIVED'

export default function CommerceDeliveryAssignmentsPage() {
  const [routeRefresh, setRouteRefresh] = useState(0)
  const t = useT()
  const [searchParams] = useSearchParams()
  const initialCourierId = searchParams.get('courier_id') || ''

  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [couriers, setCouriers] = useState<AdminCourierListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<DeliveryStatusFilter>('ALL')

  // Modal / Drawer states
  const [assigningOrder, setAssigningOrder] = useState<AdminOrderItem | null>(null)
  const [selectedCourierId, setSelectedCourierId] = useState(initialCourierId)
  const [notes, setNotes] = useState('')

  // Operational detail drawer
  const [detailOrder, setDetailOrder] = useState<AdminOrderItem | null>(null)
  const [fullOrderDetail, setFullOrderDetail] = useState<AdminOrderDetail | null>(null)
  const [handoverDetail, setHandoverDetail] = useState<AdminDeliveryHandover | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCourier, setDetailCourier] = useState<AdminCourierListItem | null>(null)

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [allOrders, courierRes] = await Promise.all([
        loadAllOrders(),
        adminCommerceApi.listCouriers({
          limit: 100,
        }),
      ])
      setOrders(allOrders)
      setCouriers((courierRes.couriers || [])
        .filter(c => c.status === 'ACTIVE')
        .sort((a, b) => (AVAILABILITY_ORDER[a.availability] ?? 3) - (AVAILABILITY_ORDER[b.availability] ?? 3)))
    } catch (err) {
      console.error('Failed to load dispatch queue data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Fetch full detail when an order detail is selected
  const openOperationalDetail = async (order: AdminOrderItem) => {
    setDetailOrder(order)
    setDetailLoading(true)
    setDetailCourier(null)
    // The order carries the courier's user id; the courier record (contact,
    // vehicle, delivery record) is fetched fresh for the sheet.
    const courierRef = couriers.find(c => c.user_id === order.assigned_courier_id)
    try {
      const [detailRes, handoverRes, courierRes] = await Promise.allSettled([
        adminCommerceApi.getOrder(order.id),
        adminCommerceApi.getDeliveryHandover(order.id),
        courierRef ? adminCommerceApi.getCourierDetail(courierRef.id) : Promise.reject(new Error('NO_COURIER'))
      ])
      if (courierRes.status === 'fulfilled') setDetailCourier(courierRes.value)
      else if (courierRef) setDetailCourier(courierRef)

      if (detailRes.status === 'fulfilled') setFullOrderDetail(detailRes.value)
      else setFullOrderDetail(null)

      if (handoverRes.status === 'fulfilled') setHandoverDetail(handoverRes.value)
      else setHandoverDetail(null)
    } catch (err) {
      console.error('Failed to load detail', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningOrder || !selectedCourierId) return
    setActionLoading(true)
    setMsg(null)
    try {
      await adminCommerceApi.assignCourier(assigningOrder.id, {
        courier_id: selectedCourierId,
        notes: notes || undefined,
      })
      setMsg({
        type: 'success',
        text: t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.assignSuccess', { number: assigningOrder.order_number })
      })
      setAssigningOrder(null)
      setNotes('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.assignFailed') })
    } finally {
      setActionLoading(false)
    }
  }

  // Filter orders based on active status tab and search query
  const filteredOrders = orders.filter((o) => {
    // Status tab filter
    if (activeTab !== 'ALL') {
      const status = (o.delivery_status || o.status || '').toUpperCase()
      if (activeTab === 'READY_FOR_PICKUP' && !status.includes('READY')) return false
      if (activeTab === 'COURIER_ASSIGNED' && status !== 'COURIER_ASSIGNED') return false
      if (activeTab === 'PICKED_UP' && status !== 'PICKED_UP') return false
      if (activeTab === 'IN_TRANSIT' && status !== 'IN_TRANSIT') return false
      if (activeTab === 'RECEIVED' && status !== 'RECEIVED' && status !== 'DELIVERED') return false
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesNum = o.order_number.toLowerCase().includes(q)
      const matchesShop = (o.shop_name || '').toLowerCase().includes(q)
      const matchesBuyer = (o.buyer_name || '').toLowerCase().includes(q)
      const matchesPhone = (o.delivery_phone || o.buyer_phone || '').toLowerCase().includes(q)
      if (!matchesNum && !matchesShop && !matchesBuyer && !matchesPhone) return false
    }
    return true
  })

  // Quick stats counters
  // KPIs are computed on every order (all pages), with the same rules as the table.
  const countReady = orders.filter(o => canAssign(o) && !o.assigned_courier_id).length
  const countAssigned = orders.filter(o => ASSIGNED_STATUSES.includes(o.delivery_status || '')).length
  const countInTransit = orders.filter(o => IN_TRANSIT_STATUSES.includes(o.delivery_status || '')).length
  const countAvailableCouriers = couriers.filter(c => c.availability === 'AVAILABLE').length

  const getStatusBadge = (order: AdminOrderItem) => {
    const status = order.delivery_status || order.status || 'PENDING'
    let bg = 'rgba(148, 163, 184, 0.15)'
    let fg = '#94a3b8'
    let label = status

    if (status.includes('READY')) {
      bg = 'rgba(234, 179, 8, 0.15)'
      fg = '#eab308'
      label = t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.badgeReady')
    } else if (status === 'COURIER_ASSIGNED') {
      bg = 'rgba(99, 102, 241, 0.15)'
      fg = '#818cf8'
      label = t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.badgeAssigned')
    } else if (status === 'PICKED_UP') {
      bg = 'rgba(14, 165, 233, 0.15)'
      fg = '#38bdf8'
      label = t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.badgePickedUp')
    } else if (status === 'IN_TRANSIT') {
      bg = 'rgba(168, 85, 247, 0.15)'
      fg = '#c084fc'
      label = t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.badgeInTransit')
    } else if (status === 'RECEIVED' || status === 'DELIVERED') {
      bg = 'rgba(34, 197, 94, 0.15)'
      fg = '#4ade80'
      label = t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.badgeDelivered')
    } else {
      // Any other state (cancelled, returned, arrived…) in words, not as a code.
      const key = `status.${status}` as TranslationKey
      const translated = t(key)
      if (translated !== key) label = translated
    }

    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, backgroundColor: bg, color: fg, display: 'inline-block' }}>
        {label}
      </span>
    )
  }

  return (
    <div style={{ color: 'var(--admin-text)' }}>
      {/* Header section */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚚</span> {t('admin.commerce.dispatchQueueTitle')}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.dispatchQueueSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/deliveries"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            📦 {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.allParcels')}
          </Link>
          <Link
            to="/admin/commerce/couriers"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🛵 {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.manageCouriers')}
          </Link>
        </div>
      </div>

      {/* Operational KPI summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.kpiAwaiting')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308', marginTop: 4 }}>{countReady}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.kpiAssigned')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>{countAssigned}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.kpiInTransit')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#c084fc', marginTop: 4 }}>{countInTransit}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.kpiAvailable')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>{countAvailableCouriers} <span style={{ fontSize: 13, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.kpiActiveOf', { count: couriers.length })}</span></div>
        </div>
      </div>

      {/* Alert message if any */}
      {msg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: msg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'success' ? '#22c55e' : '#ef4444'}`
        }}>
          {msg.text}
        </div>
      )}

      {/* Filter tabs and Search Bar */}
      <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: 'ALL', label: t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabAll') },
            { id: 'READY_FOR_PICKUP', label: `⚡ ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabReady')}` },
            { id: 'COURIER_ASSIGNED', label: `🛵 ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabAssigned')}` },
            { id: 'PICKED_UP', label: `📦 ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabPickedUp')}` },
            { id: 'IN_TRANSIT', label: `🚀 ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabInTransit')}` },
            { id: 'RECEIVED', label: `✅ ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.tabDelivered')}` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DeliveryStatusFilter)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backgroundColor: activeTab === tab.id ? 'var(--admin-primary)' : 'var(--admin-surface-2)',
                color: activeTab === tab.id ? '#ffffff' : 'var(--admin-text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder={t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              fontSize: 13
            }}
          />
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
          {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.loadingQueue')}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.empty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colOrder')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colShop')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colCustomer')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colDeliveryStatus')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colCourier')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                // orders.assigned_courier_id references users.id; assignment requests use
                // couriers.id, which the backend resolves to the associated user_id.
                const assignedCourier = couriers.find(c => c.user_id === o.assigned_courier_id)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--admin-text)' }}>#{o.order_number}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {new Date(o.created_at).toLocaleString(dateLocale())}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-primary)', marginTop: 2 }}>
                        {formatMoney(o.amount_due ?? o.final_total ?? 0, o.currency)}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{o.shop_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{o.business_name}</div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{o.buyer_name || o.delivery_contact_name || t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.defaultCustomer')}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>📞 {o.delivery_phone || o.buyer_phone || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.delivery_address}>
                        📍 {o.delivery_address || t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.noAddress')}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      {getStatusBadge(o)}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {assignedCourier ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🛵</span> {assignedCourier.first_name} {assignedCourier.last_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{assignedCourier.email}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                          {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.notAssigned')}
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openOperationalDetail(o)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-border)',
                            backgroundColor: 'var(--admin-surface-2)',
                            color: 'var(--admin-text)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          👁️ {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.deliveryDetail')}
                        </button>
                        {canAssign(o) && <button
                          onClick={() => {
                            setAssigningOrder(o)
                            setSelectedCourierId(assignedCourier?.id || (couriers[0]?.id || ''))
                            setNotes(o.courier_notes || '')
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: 'none',
                            backgroundColor: o.assigned_courier_id ? '#312e81' : 'var(--admin-primary)',
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {o.assigned_courier_id ? `🔄 ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.reassign')}` : `🛵 ${t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.assign')}`}
                        </button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Courier Assignment Modal */}
      {assigningOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            borderRadius: 12, padding: 24, maxWidth: 520, width: '100%',
            color: 'var(--admin-text)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛵</span> {assigningOrder.assigned_courier_id ? t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.modalReassign') : t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.modalAssign')} #{assigningOrder.order_number}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.modalShop')} <strong>{assigningOrder.shop_name}</strong> • {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.modalCustomer')} <strong>{assigningOrder.buyer_name || assigningOrder.delivery_contact_name}</strong>
            </p>

            <form onSubmit={handleAssign}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.selectCourierLabel')} *
                </label>
                <select
                  required
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  <option value="">-- {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.selectCourierOption')} --</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      🛵 {c.first_name} {c.last_name} ({c.email}) - {AVAILABILITY_LABEL[c.availability] ? t(AVAILABILITY_LABEL[c.availability]) : c.availability}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.notesLabel')}
                </label>
                <textarea
                  rows={3}
                  placeholder={t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setAssigningOrder(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedCourierId}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: actionLoading || !selectedCourierId ? 'not-allowed' : 'pointer',
                    opacity: actionLoading || !selectedCourierId ? 0.6 : 1
                  }}
                >
                  {actionLoading ? t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.assigning') : t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.confirmAssign')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Operational Detail Drawer / Modal */}
      {detailOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex', justifyContent: 'flex-end',
          zIndex: 1100
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            borderLeft: '1px solid var(--admin-border)',
            maxWidth: 600, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            color: 'var(--admin-text)', overflowY: 'auto'
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.detailTitle', { number: detailOrder.order_number })}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                  {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.detailStatus', { status: adminLabel(detailOrder.delivery_status || detailOrder.status) })}
                </span>
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-2)',
                  color: 'var(--admin-text)', fontWeight: 700, cursor: 'pointer'
                }}
              >
                ✕ {t('common.close')}
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                  {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.loadingDetail')}
                </div>
              ) : (
                <>
                  {/* ASSIGNED COURIER */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#f472b6', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🛵</span> {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionCourier')}
                    </h4>
                    {detailCourier ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12, fontSize: 13 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('common.name')}</div>
                          <div style={{ fontWeight: 700 }}>{detailCourier.first_name} {detailCourier.last_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{detailCourier.email}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('common.phone')}</div>
                          <div style={{ fontWeight: 700 }}>📞 {detailCourier.phone || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.vehicle')}</div>
                          <div style={{ fontWeight: 700 }}>{TRANSPORT_LABEL[detailCourier.transport_type] ? t(TRANSPORT_LABEL[detailCourier.transport_type]) : adminLabel(detailCourier.transport_type)}{detailCourier.vehicle_info ? ` · ${detailCourier.vehicle_info}` : ''}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.zoneAvailability')}</div>
                          <div style={{ fontWeight: 700 }}>{detailCourier.service_zone || '—'} · {AVAILABILITY_LABEL[detailCourier.availability] ? t(AVAILABILITY_LABEL[detailCourier.availability]) : adminLabel(detailCourier.availability)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.successfulDeliveries')}</div>
                          <div style={{ fontWeight: 700 }}>
                            {detailCourier.successful_deliveries} / {detailCourier.total_deliveries}
                            {detailCourier.total_deliveries > 0 ? ` (${Math.round((detailCourier.successful_deliveries / detailCourier.total_deliveries) * 100)} %)` : ''}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.accountStatus')}</div>
                          <div style={{ fontWeight: 700 }}>{adminLabel(detailCourier.status)}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.noCourier')}</div>
                    )}
                  </div>

                  {/* COURIER POSITION, ROUTE AND PROGRESS: the map shows itself once the
                      courier is on the way or a route was planned. */}
                  <div style={{ color: 'var(--color-text, #111)' }}>
                    {shouldShowLiveMap({ delivery_status: fullOrderDetail?.order?.delivery_status ?? detailOrder.delivery_status }) && (
                      <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px', color: '#34d399' }}>📡 {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionPosition')}</h4>
                    )}
                    <Suspense fallback={<div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.loadingMap')}</div>}>
                      <LiveCourierMap orderId={detailOrder.id} audience="admin" destinationAddress={detailOrder.delivery_address || undefined} refreshKey={routeRefresh} />
                      {ROUTE_PLANNING.includes(fullOrderDetail?.order?.delivery_status ?? detailOrder.delivery_status ?? '') && (
                        <div style={{ marginTop: 12 }}>
                          <RoutePlanner key={detailOrder.id} orderId={detailOrder.id} as="admin" deliveryAddress={detailOrder.delivery_address || undefined} onSaved={() => setRouteRefresh((n) => n + 1)} />
                        </div>
                      )}
                    </Suspense>
                  </div>

                  {/* BUYER / DESTINATION DETAILS */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👤</span> {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionBuyer')}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.recipientName')}</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.delivery_contact_name || detailOrder.buyer_name || t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.defaultCustomer')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.contactPhone')}</div>
                        <div style={{ fontWeight: 700 }}>📞 {detailOrder.delivery_phone || detailOrder.buyer_phone || '-'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.fullAddress')}</div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>📍 {detailOrder.delivery_address || t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.noAddressSaved')}</div>
                      </div>
                      {detailOrder.delivery_notes && (
                        <div style={{ gridColumn: 'span 2', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 10, borderRadius: 6, border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                          <div style={{ fontSize: 11, color: '#eab308', fontWeight: 700 }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.specialInstructions')}</div>
                          <div style={{ fontSize: 12, color: 'var(--admin-text)', marginTop: 2 }}>{detailOrder.delivery_notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SHOP / PICKUP DETAILS */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏬</span> {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionPickup')}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.businessSeller')}</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.business_name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('admin.common.shopColumn')}</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.shop_name}</div>
                      </div>
                    </div>
                  </div>

                  {/* PRODUCTS / PACKAGE CONTENT */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📦</span> {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionProducts')}
                    </h4>
                    {fullOrderDetail?.lines && fullOrderDetail.lines.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {fullOrderDetail.lines.map((line) => (
                          <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderBottom: '1px solid var(--admin-border-soft)', paddingBottom: 6 }}>
                            <div>
                              <span style={{ fontWeight: 700 }}>{line.product_name}</span>
                              <span style={{ color: 'var(--admin-text-muted)', marginLeft: 6 }}>x{line.quantity}</span>
                            </div>
                            <div style={{ fontWeight: 700 }}>{formatMoney(line.final_unit_price * line.quantity, detailOrder?.currency)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                        {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.totalItems')} <strong>{detailOrder.total_items}</strong>
                      </div>
                    )}
                  </div>

                  {/* QR HANDOVER & AUDIT TRAIL */}
                  {handoverDetail && (
                    <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#fde047', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔍</span> {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.sectionScans')}
                      </h4>
                      {handoverDetail.events && handoverDetail.events.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {handoverDetail.events.map((ev) => (
                            <div key={ev.id} style={{ fontSize: 12, padding: 8, backgroundColor: 'var(--admin-surface)', borderRadius: 6, border: '1px solid var(--admin-border-soft)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>{SCAN_TYPE_LABEL[ev.scan_type] ? t(SCAN_TYPE_LABEL[ev.scan_type]) : adminLabel(ev.scan_type)}</span>
                                <span style={{ color: ev.scan_result === 'SUCCESS' ? '#4ade80' : '#f87171' }}>{SCAN_RESULT_LABEL[ev.scan_result] ? t(SCAN_RESULT_LABEL[ev.scan_result]) : adminLabel(ev.scan_result)}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 4 }}>
                                {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.timestamp', { time: new Date(ev.created_at).toLocaleString(dateLocale()) })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                          {t('adminCommerceDeliveriesCommerceDeliveryAssignmentsPage.noScans')}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
