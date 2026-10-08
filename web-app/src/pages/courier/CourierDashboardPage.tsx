import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationLink } from '@/lib/notificationLinks'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { courierApi } from '@/api/courier'
import { useAuth } from '@/store/auth'
import { translate, useI18n } from '@/store/i18n'
import { isTerminalDeliveryStatus, isTerminalOrderStatus } from '@/lib/orderStatus'
import './courier.css'
import { CourierHandoverPanel } from '@/components/courier/CourierHandoverPanel'
import { CourierPlanPanel } from '@/components/courier/CourierPlanPanel'
import { CourierDeliveredPanel, cashLabel } from '@/components/courier/CourierDeliveredPanel'
import { useOrderEvents } from '@/lib/orderEvents'

import type { CourierEarnings, CourierMission, CourierProfile } from '@/api/types'
import { dateLocale, formatMoney } from '@/lib/format'

// Delivery statuses in which the courier is at the buyer's door.
const HANDOVER_STATUSES = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION']

type Availability = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE'
type View = 'dashboard' | 'assigned' | 'active' | 'scanner' | 'delivered' | 'history' | 'availability' | 'notifications' | 'profile' | 'detail'
type Profile = CourierProfile
type Mission = CourierMission
type History = { order_id: string; order_number: string; shop_name: string; delivery_address: string; final_status: string; delivered_at?: string }
type Notice = { id: string; title: string; body: string; type: string; is_read: boolean; created_at: string; reference_id?: string; metadata?: Record<string, unknown> }

const iconPaths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  assigned: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  active: <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-5" /></>,
  scanner: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h4v4h-7v-3" /></>,
  delivered: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  availability: <><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /><circle cx="12" cy="12" r="3" /></>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M21 3v18h-7" /></>,
  arrow: <><path d="M5 12h14M15 8l4 4-4 4" /></>,
  empty: <><path d="M4 7h16v12H4zM4 7l3-4h10l3 4M9 12h6" /></>,
  phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></>,
  mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  shop: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
}
type IconName = keyof typeof iconPaths
function Icon({ name }: { name: IconName }) {
  return <svg className="courier-icon" viewBox="0 0 24 24" aria-hidden="true">{iconPaths[name]}</svg>
}

const TRANSPORT_LABEL: Record<string, string> = {
  MOTORCYCLE: 'courierCourierDashboardPage.transportMotorcycle',
  BICYCLE: 'courierCourierDashboardPage.transportBicycle',
  CAR: 'courierCourierDashboardPage.transportCar',
  VAN: 'courierCourierDashboardPage.transportVan',
  FOOT: 'courierCourierDashboardPage.transportFoot',
  TRUCK: 'courierCourierDashboardPage.transportTruck'
}
const COURIER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'courierCourierDashboardPage.statusActive',
  PENDING: 'courierCourierDashboardPage.statusPending',
  SUSPENDED: 'courierCourierDashboardPage.statusSuspended',
  DISABLED: 'courierCourierDashboardPage.statusDisabled'
}

const nav: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'dashboard', label: 'courierCourierDashboardPage.navDashboard', icon: 'dashboard' },
  { id: 'assigned', label: 'courier.dashboard.assigned', icon: 'assigned' },
  { id: 'active', label: 'courierCourierDashboardPage.navActive', icon: 'active' },
  { id: 'scanner', label: 'courierCourierDashboardPage.navScanner', icon: 'scanner' },
  { id: 'delivered', label: 'courierCourierDashboardPage.navDelivered', icon: 'delivered' },
  { id: 'history', label: 'courier.dashboard.history', icon: 'history' },
  { id: 'availability', label: 'courier.dashboard.availability', icon: 'availability' },
  { id: 'notifications', label: 'courier.dashboard.notifications', icon: 'notifications' },
  { id: 'profile', label: 'courierCourierDashboardPage.navProfile', icon: 'profile' }
]

export default function CourierDashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('dashboard')
  const [selected, setSelected] = useState<Mission | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [history, setHistory] = useState<History[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [missionError, setMissionError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [success, setSuccess] = useState('')
  const [earnings, setEarnings] = useState<CourierEarnings | null>(null)
  const seenNotificationIds = useRef<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null)
  const { t } = useI18n()

  const showToast = (message: string, type: 'info' | 'success' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = await courierApi.getProfile()
      setProfile(p)
      if (p.status === 'SUSPENDED') {
        setMissions([])
        setHistory([])
      } else {
        setMissionError('')
        setHistoryError('')
        const [m, h] = await Promise.all([
          courierApi.getMissions().catch(() => { setMissionError(translate('courierCourierDashboardPage.loadMissionsFailed')); return null }),
          courierApi.getHistory(30).catch(() => { setHistoryError(translate('courierCourierDashboardPage.loadHistoryFailed')); return null })
        ])
        setMissions(Array.isArray(m) ? m : [])
        setHistory(Array.isArray(h) ? h : [])
        courierApi.getEarnings().then(setEarnings).catch(() => {})
      }
      setNoticeError('')
      const n: { items?: Notice[]; notifications?: Notice[] } = await api<{ items?: Notice[]; notifications?: Notice[] }>('/notifications?limit=50&offset=0').catch(() => {
        setNoticeError(translate('courierCourierDashboardPage.loadNotificationsFailed'))
        return { items: [] }
      })
      const newNotices = n.items ?? n.notifications ?? []
      setNotices(newNotices)

      const newAssignments = newNotices.filter((n: Notice) =>
        n.type === 'COURIER_ASSIGNED' && !n.is_read && !seenNotificationIds.current.has(n.id)
      )

      if (newAssignments.length > 0) {
        newAssignments.forEach((n: Notice) => seenNotificationIds.current.add(n.id))
        showToast(translate('courier.dashboard.newMissionToast'), 'info')
        try {
          const m = await courierApi.getMissions()
          if (Array.isArray(m)) setMissions(m)
        } catch {}
      }

      const currentReadIds = new Set(newNotices.filter((n: Notice) => n.is_read).map((n: Notice) => n.id))
      seenNotificationIds.current = new Set([...seenNotificationIds.current].filter(id => !currentReadIds.has(id)))
    } catch {
      setError(translate('courierCourierDashboardPage.loadProfileFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [load])

  useOrderEvents(() => void load())

  const assigned = missions.filter(m => m.delivery_status === 'COURIER_ASSIGNED')
  const active = missions.filter(m => m.delivery_status === 'RETURNING_TO_SELLER' || (m.delivery_status !== 'COURIER_ASSIGNED' && !isTerminalDeliveryStatus(m.delivery_status) && !isTerminalOrderStatus(m.status)))
  const current = active[0]
  const unread = notices.filter(n => !n.is_read).length

  // Mission for contextual right sidebar: explicitly selected mission > current active mission > first assigned mission
  const sidebarMission = selected || current || assigned[0] || null

  const runAction = async (key: string, fn: () => Promise<unknown>, message?: string, goActive = false) => {
    setBusy(key)
    setError('')
    setSuccess('')
    try {
      await fn()
      setSuccess(message || t('courierCourierDashboardPage.actionSuccess'))
      if (goActive) { setView('active') }
      await load()
    } catch (err: any) {
      const msg = err?.message || err?.error || t('courier.dashboard.actionError')
      setError(t('courierCourierDashboardPage.actionFailed', { message: msg }))
    } finally {
      setBusy('')
    }
  }

  const act = async (path: string, body?: unknown, message?: string) => {
    setBusy(path)
    setError('')
    setSuccess('')
    try {
      await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
      setSuccess(message || t('courierCourierDashboardPage.actionSuccess'))
      await load()
    } catch (err: any) {
      const msg = err?.message || err?.error || t('courier.dashboard.actionError')
      setError(t('courierCourierDashboardPage.actionFailed', { message: msg }))
    } finally {
      setBusy('')
    }
  }

  const reject = (m: Mission) => {
    const reason = window.prompt(t('courier.dashboard.rejectReason'))
    if (reason?.trim()) void runAction(`/courier/missions/${m.order_id}/reject`, () => courierApi.reject(m.order_id, reason.trim()), t('courier.dashboard.rejected'))
  }

  const availability = async (v: Availability) => {
    setBusy('availability')
    try {
      await courierApi.updateAvailability(v)
      await load()
    } catch (err: any) {
      const msg = err?.message || err?.error || t('courier.dashboard.actionError')
      setError(t('courierCourierDashboardPage.availabilityFailed', { message: msg }))
    } finally {
      setBusy('')
    }
  }

  const scan = (type: 'PICKUP', m: Mission) => navigate(`/courier/scan?type=${type}&order_id=${m.order_id}`)

  const choose = (next: View) => {
    setView(next)
    setSuccess('')
    ;(document.querySelector('.courier-content') as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading && !profile) {
    return (
      <main className="courier-page courier-loading">
        <div className="courier-glass courier-skeleton courier-skeleton-side" />
        <div className="courier-glass courier-skeleton courier-skeleton-main" />
      </main>
    )
  }

  const navLabel = nav.find(n => n.id === view)?.label
  const title = view === 'detail' ? t('courierCourierDashboardPage.missionDetails') : navLabel ? t(navLabel) : t('courierCourierDashboardPage.navDashboard')
  const initials = `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`.toUpperCase()

  return (
    <main className="courier-page">
      <div className="courier-orb courier-orb-one" />
      <div className="courier-orb courier-orb-two" />
      <div className="courier-workspace">
        {/* LEFT NAVIGATION SIDEBAR */}
        <aside className="courier-glass courier-sidebar">
          <div className="courier-brand">
            <div className="courier-brand-mark">
              <img src="/logo.png" alt="TBK" className="courier-brand-logo-img" />
            </div>
            <div>
              <strong>{t('courier.dashboard.brand')}</strong>
              <span>{t('courierCourierDashboardPage.brandSubtitle')}</span>
            </div>
          </div>
          <nav aria-label={t('courierCourierDashboardPage.navAria')}>
            {nav.map(item => (
              <button
                key={item.id}
                className={view === item.id ? 'is-selected' : ''}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => choose(item.id)}
              >
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
                {item.id === 'assigned' && assigned.length > 0 && <b>{assigned.length}</b>}
                {item.id === 'active' && active.length > 0 && <b className="badge-active">{active.length}</b>}
                {item.id === 'notifications' && unread > 0 && <b>{unread}</b>}
              </button>
            ))}
          </nav>
          <div className="courier-sidebar-user">
            <div className="courier-avatar">{initials || 'TB'}</div>
            <div className="courier-user-info">
              <strong>{profile?.first_name} {profile?.last_name}</strong>
              <span className={profile?.availability === 'AVAILABLE' ? 'is-online' : ''}>
                {profile?.availability === 'AVAILABLE' ? t('courier.availability.AVAILABLE') : t('courier.availability.UNAVAILABLE')}
              </span>
            </div>
          </div>
          <button className="courier-logout" onClick={() => void logout().then(() => navigate('/livreur/login'))}>
            <Icon name="logout" />
            {t('courier.dashboard.logout')}
          </button>
        </aside>

        {/* CENTRAL MISSIONS AREA */}
        <section className="courier-content">
          <header className="courier-content-header">
            <div>
              <p className="courier-eyebrow">{t('courier.dashboard.brand')}</p>
              <h1>{title}</h1>
            </div>
            <div className={`courier-presence ${profile?.availability === 'AVAILABLE' ? 'is-online' : ''}`}>
              <span />
              {profile?.status === 'SUSPENDED' ? t('courierCourierDashboardPage.statusSuspended') : profile?.availability === 'AVAILABLE' ? t('courier.availability.AVAILABLE') : t('courier.availability.UNAVAILABLE')}
            </div>
          </header>

          {error && (
            <div className="courier-glass courier-alert courier-alert-error">
              <span>{error}</span>
              <button onClick={() => void load()}>{t('common.retry')}</button>
            </div>
          )}
          {success && <div className="courier-glass courier-alert courier-alert-success">{success}</div>}
          {toast && (
            <div className={`courier-glass courier-alert courier-alert-${toast.type} courier-toast-floating`}>
              <span>{toast.message}</span>
            </div>
          )}

          <div className="courier-panel">
            {renderView()}
          </div>
        </section>

        {/* CONTEXTUAL RIGHT SIDEBAR */}
        <aside className="courier-glass courier-aside-details">
          <ContextualRightSidebar
            mission={sidebarMission}
            onSelectMission={setSelected}
            onChooseView={choose}
            currentOrderNumber={current?.order_number}
          />
        </aside>

        {/* RESPONSIVE MOBILE NAVIGATION */}
        <nav className="courier-mobile-nav" aria-label={t('courierCourierDashboardPage.mobileNavAria')}>
          {nav.map(item => (
            <button
              key={item.id}
              className={view === item.id ? 'is-selected' : ''}
              onClick={() => choose(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {item.id === 'assigned' && assigned.length > 0 && <b>{assigned.length}</b>}
              {item.id === 'notifications' && unread > 0 && <b>{unread}</b>}
            </button>
          ))}
        </nav>
      </div>
    </main>
  )

  function renderView() {
    switch (view) {
      case 'dashboard':
        return <Overview />
      case 'assigned':
        return <MissionSection items={assigned} empty={t('courier.dashboard.noAssigned')} assignedMode />
      case 'active':
        return current ? ActiveMission({ mission: current }) : <Empty title={t('courier.dashboard.noMissions')} body={t('courierCourierDashboardPage.acceptToStart')} />
      case 'scanner':
        return <Scanner />
      case 'delivered':
        return <CourierDeliveredPanel />
      case 'history':
        return <HistoryPanel />
      case 'availability':
        return <AvailabilityPanel />
      case 'notifications':
        return <NotificationsPanel />
      case 'profile':
        return <ProfilePanel />
      case 'detail':
        return selected ? ActiveMission({ mission: selected }) : <Empty title={t('courierCourierDashboardPage.missionNotFound')} body={t('courierCourierDashboardPage.backToList')} />
    }
  }

  function Overview() {
    return (
      <>
        <section className="courier-welcome courier-glass">
          <div>
            <p className="courier-eyebrow">{t('courierCourierDashboardPage.overview')}</p>
            <h2>{t('courierCourierDashboardPage.hello', { name: profile?.first_name })}</h2>
            <p>{t('courier.dashboard.readySubtitle')}</p>
          </div>
          <div className="courier-avatar courier-avatar-large">{initials || 'TB'}</div>
        </section>

        {missionError || historyError ? (
          <section className="courier-glass courier-section">
            <Heading title={t('courierCourierDashboardPage.dataUnavailable')} eyebrow={t('courierCourierDashboardPage.liveConnection')} />
            {missionError && <SectionError message={missionError} retry={load} />}
            {historyError && <SectionError message={historyError} retry={load} />}
          </section>
        ) : (
          <>
            <section className="courier-stats">
              <Stat icon="assigned" value={assigned.length} label={t('courier.dashboard.assigned')} />
              <Stat icon="active" value={active.length} label={t('courier.dashboard.active')} />
              <Stat icon="history" value={history.length} label={t('courier.dashboard.completed')} />
              <button type="button" className="courier-stat-link" onClick={() => choose('delivered')}>
                <Stat
                  icon="cash"
                  value={cashLabel(earnings)}
                  label={t((earnings?.orders_delivered ?? 0) === 1 ? 'courierCourierDashboardPage.cashTodayOne' : 'courierCourierDashboardPage.cashTodayOther', { count: earnings?.orders_delivered ?? 0 })}
                />
              </button>
            </section>

            <section className="courier-glass courier-section">
              <Heading title={t('courier.dashboard.currentMission')} eyebrow={t('courierCourierDashboardPage.priority')} />
              {current ? (
                <MissionCard mission={current} />
              ) : assigned.length > 0 ? (
                <MissionCard mission={assigned[0]} assignedMode />
              ) : (
                <Empty title={t('courier.dashboard.noMissions')} body={t('courier.dashboard.emptyHint')} />
              )}
            </section>
          </>
        )}
      </>
    )
  }

  function MissionSection({ items, empty, assignedMode = false }: { items: Mission[]; empty: string; assignedMode?: boolean }) {
    return (
      <section className="courier-glass courier-section">
        <Heading title={title} eyebrow={t(items.length === 1 ? 'courierCourierDashboardPage.missionCountOne' : 'courierCourierDashboardPage.missionCountOther', { count: items.length })} />
        {missionError && <SectionError message={missionError} retry={load} />}
        {items.length ? (
          <div className="courier-mission-list">
            {items.map(m => <MissionCard key={m.order_id} mission={m} assignedMode={assignedMode} />)}
          </div>
        ) : (
          !missionError && <Empty title={empty} body={t('courier.dashboard.emptyHint')} />
        )}
      </section>
    )
  }

  function MissionCard({ mission: m, assignedMode = false }: { mission: Mission; assignedMode?: boolean }) {
    const isAccepting = busy.includes(`/missions/${m.order_id}/accept`)
    const isRejecting = busy.includes(`/missions/${m.order_id}/reject`)
    const isSelected = selected?.order_id === m.order_id

    return (
      <article
        className={`courier-mission ${isSelected ? 'is-selected' : ''}`}
        onClick={() => setSelected(m)}
      >
        <div className="courier-row">
          <div>
            <p className="courier-eyebrow">{t('courier.dashboard.order')}</p>
            <h3>#{m.order_number}</h3>
          </div>
          <span className={`courier-status status-${m.delivery_status}`}>
            {t(`courier.status.${m.delivery_status}`)}
          </span>
        </div>

        <div className="courier-mission-facts">
          <Fact label={t('courier.dashboard.shop')} value={m.shop_name} />
          <Fact label={t('courierCourierDashboardPage.sellerBusiness')} value={m.business_name} />
          <Fact label={t('courier.dashboard.pickupAddress')} value={m.shop_address} />
          <Fact label={t('courier.handover.buyer')} value={m.delivery_contact} />
          <Fact label={t('courier.dashboard.phone')} value={m.delivery_phone} />
          <Fact label={t('courier.dashboard.deliveryAddress')} value={m.delivery_address} />
          <Fact
            label={t('courierCourierDashboardPage.totalToCollect')}
            value={t('courierCourierDashboardPage.totalWithDelivery', {
              total: formatMoney(m.total_amount ?? 0, m.currency || 'USD'),
              fee: formatMoney(m.delivery_fee ?? 0, m.currency || 'USD')
            })}
          />
          <Fact label={t('courierCourierDashboardPage.dateTime')} value={m.assigned_at ? new Date(m.assigned_at).toLocaleString(dateLocale()) : '—'} />
          {m.delivery_notes && <Fact label={t('courierCourierDashboardPage.instructions')} value={m.delivery_notes} />}
        </div>

        <div className="courier-actions" onClick={e => e.stopPropagation()}>
          {(assignedMode || m.delivery_status === 'COURIER_ASSIGNED') && (
            <>
              <button
                disabled={!!busy}
                className="courier-btn courier-btn-primary"
                onClick={() => void runAction(`/courier/missions/${m.order_id}/accept`, () => courierApi.accept(m.order_id), t('courier.dashboard.accepted'), true)}
              >
                {isAccepting ? t('courierCourierDashboardPage.accepting') : t('courier.dashboard.accept')}
              </button>
              <button
                disabled={!!busy}
                className="courier-btn courier-btn-danger"
                onClick={() => reject(m)}
              >
                {isRejecting ? t('courierCourierDashboardPage.rejecting') : t('courierCourierDashboardPage.rejectMission')}
              </button>
            </>
          )}
          <button
            className="courier-btn courier-btn-quiet"
            onClick={() => {
              setSelected(m)
              setView('detail')
            }}
          >
            {t('courierCourierDashboardPage.viewDetails')}
            <Icon name="arrow" />
          </button>
        </div>
      </article>
    )
  }

  function ActiveMission({ mission: m }: { mission: Mission }) {
    const atDoor = HANDOVER_STATUSES.includes(m.delivery_status)
    return (
      <section className="courier-glass courier-section">
        <Heading title={t('courierCourierDashboardPage.orderNumber', { number: m.order_number })} eyebrow={t('courierCourierDashboardPage.navActive')} />
        <MissionCard mission={m} />
        <div className="courier-timeline">
          <Timeline m={m} />
        </div>
        <div className="courier-next">
          <Heading title={t('courierCourierDashboardPage.nextAction')} eyebrow={t(`courier.status.${m.delivery_status}`)} />
          <ActionButtons mission={m} />
        </div>
        <CourierPlanPanel key={`plan-${m.order_id}`} mission={m} onChanged={load} />
        {atDoor && <CourierHandoverPanel key={m.order_id} orderId={m.order_id} />}
        <div className="courier-actions" style={{ marginTop: 16 }}>
          <button className="courier-btn courier-btn-quiet" onClick={() => navigate(`/courier/missions/${m.order_id}`)}>
            {t('courierCourierDashboardPage.openMission')}
            <Icon name="arrow" />
          </button>
        </div>
      </section>
    )
  }

  function Scanner() {
    const pickup = current && ['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(current.delivery_status) && ['READY', 'READY_FOR_PICKUP'].includes(current.status)
    const delivery = current?.delivery_status === 'COURIER_ARRIVED'
    return (
      <section className="courier-scanner-grid">
        <ScanCard title={t('courierCourierDashboardPage.scanAtSellerTitle')} body={t('courierCourierDashboardPage.scanAtSellerBody')} enabled={!!pickup} onClick={() => current && scan('PICKUP', current)} />
        <ScanCard title={t('courierCourierDashboardPage.scanAtBuyerTitle')} body={t('courierCourierDashboardPage.scanAtBuyerBody')} enabled={!!delivery} onClick={() => current && navigate(`/courier/missions/${current.order_id}`)} />
        {!pickup && !delivery && <div className="courier-glass courier-empty-wide">{t('courierCourierDashboardPage.noScanNeeded')}</div>}
      </section>
    )
  }

  function HistoryPanel() {
    return (
      <section className="courier-glass courier-section">
        <Heading title={t('courierCourierDashboardPage.historyTitle')} eyebrow={t(history.length === 1 ? 'courierCourierDashboardPage.itemCountOne' : 'courierCourierDashboardPage.itemCountOther', { count: history.length })} />
        {historyError && <SectionError message={historyError} retry={load} />}
        {history.length ? (
          <div className="courier-history-list">
            {history.map(h => (
              <article key={h.order_id}>
                <Icon name="history" />
                <div>
                  <strong>{t('courierCourierDashboardPage.orderNumber', { number: h.order_number })}</strong>
                  <p>{h.shop_name} · {h.delivery_address}</p>
                </div>
                <div>
                  <span className="courier-status">{t(`courier.status.${h.final_status}`)}</span>
                  <time>{h.delivered_at ? new Date(h.delivered_at).toLocaleString(dateLocale()) : '—'}</time>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !historyError && <Empty title={t('courierCourierDashboardPage.noCompleted')} body={t('courierCourierDashboardPage.noCompletedBody')} />
        )}
      </section>
    )
  }

  function AvailabilityPanel() {
    return (
      <section className="courier-glass courier-section courier-centered">
        <Heading title={t('courierCourierDashboardPage.yourAvailability')} eyebrow={t('courier.dashboard.status')} />
        <div className={`courier-availability-orb ${profile?.availability === 'AVAILABLE' ? 'is-online' : ''}`}>
          <span />
        </div>
        <h3>{profile?.status === 'SUSPENDED' ? t('courier.dashboard.suspended') : profile?.availability === 'AVAILABLE' ? t('courierCourierDashboardPage.youAreAvailable') : t('courierCourierDashboardPage.youAreUnavailable')}</h3>
        <p>{profile?.status === 'SUSPENDED' ? t('courier.dashboard.suspendedBody') : t('courierCourierDashboardPage.availabilityExplain')}</p>
        <div className="courier-segmented">
          {(['AVAILABLE', 'UNAVAILABLE'] as Availability[]).map(v => (
            <button key={v} className={profile?.availability === v ? 'is-selected' : ''} disabled={busy === 'availability' || profile?.status === 'SUSPENDED'} onClick={() => void availability(v)}>
              {t(`courier.availability.${v}`)}
            </button>
          ))}
        </div>
      </section>
    )
  }

  function NotificationsPanel() {
    const handleNotificationClick = (n: Notice) => {
      if (!n.is_read) void act(`/notifications/${n.id}/read`)
      if (n.reference_id && n.type === 'COURIER_ASSIGNED') {
        const mission = missions.find(m => m.order_id === n.reference_id)
        if (mission) {
          setSelected(mission)
          setView('detail')
          return
        }
        navigate(`/courier/missions/${n.reference_id}`)
        return
      }
      const link = notificationLink(n)
      if (link) navigate(link)
    }

    return (
      <section className="courier-glass courier-section">
        <Heading title={t('courier.dashboard.notifications')} eyebrow={t(unread === 1 ? 'courierCourierDashboardPage.unreadOne' : 'courierCourierDashboardPage.unreadOther', { count: unread })} />
        <div className="courier-notice-actions">
          <button className="courier-btn courier-btn-quiet" onClick={() => navigate('/courier/notifications/settings')}>
            {t('courierCourierDashboardPage.notificationSettings')}
          </button>
          {unread > 0 && (
            <button className="courier-btn courier-btn-quiet" onClick={() => void act('/notifications/read-all', undefined, t('courierCourierDashboardPage.allMarkedRead'))}>
              {t('courierCourierDashboardPage.markAllRead')}
            </button>
          )}
        </div>
        {noticeError && <SectionError message={noticeError} retry={load} />}
        {notices.length ? (
          <div className="courier-notices">
            {notices.map(n => (
              <button key={n.id} className={!n.is_read ? 'is-unread' : ''} onClick={() => void handleNotificationClick(n)}>
                <Icon name="notifications" />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <time>{new Date(n.created_at).toLocaleString(dateLocale())}</time>
                </div>
              </button>
            ))}
          </div>
        ) : (
          !noticeError && <Empty title={t('courierCourierDashboardPage.noNotifications')} body={t('courierCourierDashboardPage.noNotificationsBody')} />
        )}
      </section>
    )
  }

  function ProfilePanel() {
    const addressParts = [profile?.building_number, profile?.street, profile?.commune, profile?.city, profile?.province].filter(Boolean)
    return (
      <section className="courier-glass courier-section">
        <div className="courier-profile-head">
          <div className="courier-avatar courier-avatar-large">{initials || 'TB'}</div>
          <div>
            <h2>{profile?.first_name} {profile?.last_name}</h2>
            <p>{profile?.email}</p>
          </div>
        </div>
        <div className="courier-profile-grid">
          <Fact label={t('auth.firstName')} value={profile?.first_name} />
          <Fact label={t('auth.lastName')} value={profile?.last_name} />
          <Fact label={t('common.email')} value={profile?.email} />
          <Fact label={t('common.phone')} value={profile?.phone} />
          <Fact label={t('courierCourierDashboardPage.transport')} value={TRANSPORT_LABEL[profile?.transport_type ?? ''] ? t(TRANSPORT_LABEL[profile?.transport_type ?? '']) : profile?.transport_type} />
          <Fact label={t('courierCourierDashboardPage.vehicle')} value={profile?.vehicle_info} />
          <Fact label={t('courierCourierDashboardPage.serviceZone')} value={profile?.service_zone} />
          <Fact label={t('courierCourierDashboardPage.address')} value={addressParts.length ? addressParts.join(', ') : '—'} />
          {profile?.landmark && <Fact label={t('courierCourierDashboardPage.landmark')} value={profile?.landmark} />}
          <Fact label={t('common.status')} value={COURIER_STATUS_LABEL[profile?.status ?? ''] ? t(COURIER_STATUS_LABEL[profile?.status ?? '']) : profile?.status} />
        </div>
        <button className="courier-logout courier-logout-inline" onClick={() => void logout().then(() => navigate('/livreur/login'))}>
          <Icon name="logout" />
          {t('courier.dashboard.logout')}
        </button>
      </section>
    )
  }

  function ActionButtons({ mission: m }: { mission: Mission }) {
    const isPickingUp = busy.includes(`/missions/${m.order_id}/pickup`)
    const isArriving = busy.includes(`/missions/${m.order_id}/arrive`)
    return (
      <div className="courier-actions">
        {['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(m.delivery_status) && ['READY', 'READY_FOR_PICKUP'].includes(m.status) && (
          <>
            <button
              disabled={!!busy}
              className="courier-btn courier-btn-primary"
              onClick={() => void runAction(`/courier/missions/${m.order_id}/pickup`, () => courierApi.pickup(m.order_id), t('courierCourierDashboardPage.pickupConfirmed'))}
            >
              {isPickingUp ? t('courierCourierDashboardPage.confirming') : t('courierCourierDashboardPage.confirmPickup')}
            </button>
            <button className="courier-btn courier-btn-scan" onClick={() => scan('PICKUP', m)}>
              <Icon name="scanner" />
              {t('courierCourierDashboardPage.scanSellerQr')}
            </button>
          </>
        )}
        {m.delivery_status === 'PICKED_UP' && (
          <button
            disabled={!!busy || !m.expected_delivery_date}
            title={m.expected_delivery_date ? undefined : t('courierPlan.required')}
            className="courier-btn courier-btn-primary"
            onClick={() => void runAction(`/courier/missions/${m.order_id}/start`, () => courierApi.start(m.order_id), t('courier.dashboard.started'))}
          >
            {busy.includes(`/missions/${m.order_id}/start`) ? t('courierCourierDashboardPage.starting') : t('courierCourierDashboardPage.startDelivery')}
          </button>
        )}
        {m.delivery_status === 'IN_TRANSIT' && (
          <button
            disabled={!!busy}
            className="courier-btn courier-btn-primary"
            onClick={() => void runAction(`/courier/missions/${m.order_id}/arrive`, () => courierApi.arrive(m.order_id), t('courier.dashboard.arrived'))}
          >
            {isArriving ? t('courierCourierDashboardPage.confirmingArrival') : t('courier.dashboard.arrive')}
          </button>
        )}
        {m.delivery_status === 'COURIER_ARRIVED' && (
          <p className="courier-muted">{t('courierCourierDashboardPage.arrivedNote')}</p>
        )}
      </div>
    )
  }
}

function ContextualRightSidebar({
  mission,
  onSelectMission,
  onChooseView,
  currentOrderNumber,
}: {
  mission: Mission | null
  onSelectMission: (m: Mission | null) => void
  onChooseView: (v: View) => void
  currentOrderNumber?: string
}) {
  const { t } = useI18n()

  if (!mission) {
    return (
      <div className="courier-aside-empty">
        <div className="courier-aside-empty-icon">
          <Icon name="active" />
        </div>
        <h3>{t('courierCourierDashboardPage.missionDetails')}</h3>
        <p>{t('courier.dashboard.emptyHint')}</p>
      </div>
    )
  }

  const isCurrent = currentOrderNumber === mission.order_number

  return (
    <div className="courier-aside-container">
      <div className="courier-aside-header">
        <div>
          <span className="courier-eyebrow">{t('courier.dashboard.order')}</span>
          <h2>#{mission.order_number}</h2>
        </div>
        <span className={`courier-status status-${mission.delivery_status}`}>
          {t(`courier.status.${mission.delivery_status}`)}
        </span>
      </div>

      {isCurrent && (
        <div className="courier-active-badge">
          <Icon name="active" />
          <span>{t('courierCourierDashboardPage.navActive')}</span>
        </div>
      )}

      {/* Pickup & Delivery Addresses */}
      <div className="courier-aside-card">
        <div className="courier-aside-section">
          <div className="courier-aside-section-title">
            <Icon name="shop" />
            <span>{t('courier.dashboard.pickupAddress')}</span>
          </div>
          <strong className="courier-aside-value">{mission.shop_name}</strong>
          {mission.business_name && <small className="courier-aside-sub">{mission.business_name}</small>}
          <p className="courier-aside-address">{mission.shop_address || '—'}</p>
        </div>

        <div className="courier-aside-divider" />

        <div className="courier-aside-section">
          <div className="courier-aside-section-title">
            <Icon name="mapPin" />
            <span>{t('courier.dashboard.deliveryAddress')}</span>
          </div>
          <strong className="courier-aside-value">{mission.delivery_contact || '—'}</strong>
          {mission.delivery_phone && (
            <a href={`tel:${mission.delivery_phone}`} className="courier-phone-link">
              <Icon name="phone" />
              <span>{mission.delivery_phone}</span>
            </a>
          )}
          <p className="courier-aside-address">{mission.delivery_address || '—'}</p>
        </div>
      </div>

      {/* Amount & Fees */}
      <div className="courier-aside-card courier-aside-finance">
        <div className="courier-aside-finance-row">
          <span>{t('courierCourierDashboardPage.totalToCollect')}</span>
          <strong>{formatMoney(mission.total_amount ?? 0, mission.currency || 'USD')}</strong>
        </div>
        <div className="courier-aside-finance-subrow">
          <span>{t('admin.orders.fieldDeliveryFee')}</span>
          <span>{formatMoney(mission.delivery_fee ?? 0, mission.currency || 'USD')}</span>
        </div>
      </div>

      {/* Instructions */}
      {mission.delivery_notes && (
        <div className="courier-aside-card courier-aside-notes">
          <span className="courier-eyebrow">{t('courierCourierDashboardPage.instructions')}</span>
          <p>{mission.delivery_notes}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="courier-aside-card">
        <span className="courier-eyebrow">{t('admin.orders.deliveryStatus')}</span>
        <VerticalTimeline mission={mission} />
      </div>

      {/* Primary Link Action */}
      <div className="courier-aside-footer">
        <button
          className="courier-btn courier-btn-primary courier-btn-full"
          onClick={() => {
            onSelectMission(mission)
            onChooseView('detail')
          }}
        >
          {t('courierCourierDashboardPage.viewDetails')}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  )
}

function VerticalTimeline({ mission: m }: { mission: Mission }) {
  const { t } = useI18n()
  const steps: Array<[string, string | undefined]> = [
    ['courier.timeline.assigned', m.assigned_at],
    ['courier.timeline.accepted', m.accepted_at],
    ['courierCourierDashboardPage.stepReady', m.ready_at],
    ['courier.timeline.picked', m.picked_up_at],
    ['courierCourierDashboardPage.stepOnTheWay', m.started_at],
    ['courier.timeline.arrived', m.arrived_at],
    ['courierCourierDashboardPage.stepDelivered', m.delivered_at]
  ]

  return (
    <ul className="courier-vtimeline">
      {steps.map(([label, at]) => {
        const isDone = !!at
        return (
          <li key={label} className={isDone ? 'is-done' : ''}>
            <span className="courier-vtimeline-dot" />
            <div className="courier-vtimeline-content">
              <strong>{t(label)}</strong>
              {at && <time>{new Date(at).toLocaleString(dateLocale())}</time>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Heading({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="courier-heading">
      <div>
        <p className="courier-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: IconName; value: number | string; label: string }) {
  return (
    <article className="courier-glass courier-stat">
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="courier-fact">
      <small>{label}</small>
      <strong>{value || '—'}</strong>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="courier-empty">
      <Icon name="empty" />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function SectionError({ message, retry }: { message: string; retry: () => void | Promise<void> }) {
  const { t } = useI18n()
  return (
    <div className="courier-section-error" role="alert">
      <span>{message}</span>
      <button onClick={() => void retry()}>{t('common.retry')}</button>
    </div>
  )
}

function ScanCard({ title, body, enabled, onClick }: { title: string; body: string; enabled: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return (
    <article className="courier-glass courier-scan-card">
      <span>
        <Icon name="scanner" />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="courier-btn courier-btn-scan" disabled={!enabled} onClick={onClick}>
        {t('courierCourierDashboardPage.scanQr')}
      </button>
    </article>
  )
}

function Timeline({ m }: { m: Mission }) {
  const { t } = useI18n()
  const steps = [
    ['courier.timeline.assigned', m.assigned_at],
    ['courier.timeline.accepted', m.accepted_at],
    ['courierCourierDashboardPage.stepReady', m.ready_at],
    ['courier.timeline.picked', m.picked_up_at],
    ['courierCourierDashboardPage.stepOnTheWay', m.started_at],
    ['courier.timeline.arrived', m.arrived_at],
    ['courierCourierDashboardPage.stepDelivered', m.delivered_at]
  ]
  return (
    <ol>
      {steps.map(([label, at]) => (
        <li key={label as string} className={at ? 'is-done' : ''}>
          <i />
          <div>
            <strong>{t(label as string)}</strong>
            {at && <time>{new Date(at).toLocaleString(dateLocale())}</time>}
          </div>
        </li>
      ))}
    </ol>
  )
}
