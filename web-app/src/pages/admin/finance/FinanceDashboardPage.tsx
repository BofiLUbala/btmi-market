import { useState, useEffect } from 'react'
import { formatMoney } from '@/lib/format'
import { useParams } from 'react-router-dom'
import {
  adminFinanceApi,
  AdminFinancialSummary,
  AdminPaymentListItem,
  AdminPointUser,
  AdminUserPointAccount,
  AdminSellerGrowthItem,
  AdminProductReviewItem,
  AdminShopReviewItem,
  AdminCaseListItem,
  AdminCaseDetail,
  AdminPaymentDetail,
  AdminRiskEvent,
  AdminPointTransaction
  ,FinanceDashboardReport
  ,FinanceBreakdownItem
  ,FinanceTimeseriesPoint
  ,FinanceBreakdownGroup
  ,AdminPaymentMethodConfig
} from '../../../api/admin'
import FinanceTrendChart from '@/components/ui/FinanceTrendChart'
import { useT } from '@/store/i18n'
import { useAdminAuth } from '@/store/adminAuth'
import { AdminStatusBadge as StatusBadge } from '@/components/admin/AdminStatusBadge'
import { lineLabel } from '@/lib/lineLabel'

/** PAID is what a settlement writes today; VERIFIED is the same fact on older rows. */
const SETTLED_STATUSES = ['PAID', 'VERIFIED']

type ActiveTab = 'overview' | 'payment_config' | 'payments' | 'confirmation' | 'points' | 'growth' | 'reviews_product' | 'reviews_shop' | 'cases' | 'support' | 'risk' | 'trust'

/** URL slug -> feature. The sidebar links to these, so a refresh or a deep link
 *  reopens the same view instead of dropping back to the summary. */
const FEATURE_BY_SLUG: Record<string, ActiveTab> = {
  payments: 'payments',
  'payment-config': 'payment_config',
  confirmation: 'confirmation',
  points: 'points',
  growth: 'growth',
  'reviews-product': 'reviews_product',
  'reviews-shop': 'reviews_shop',
  cases: 'cases',
  support: 'support',
  risk: 'risk',
  trust: 'trust'
}

const FEATURE_TITLE_KEY: Record<ActiveTab, string> = {
  overview: 'admin.layout.itemOverview',
  payment_config: 'admin.finance.paymentConfiguration',
  payments: 'admin.layout.itemCashPayments',
  confirmation: 'admin.layout.itemCashConfirmation',
  points: 'admin.layout.itemBuyerPoints',
  growth: 'admin.layout.itemSellerGrowth',
  reviews_product: 'admin.layout.itemProductReviews',
  reviews_shop: 'admin.layout.itemShopReviews',
  cases: 'admin.layout.itemCases',
  support: 'admin.layout.itemSupport',
  risk: 'admin.layout.itemRisk',
  trust: 'admin.layout.itemTrust'
}

const PAGE_SIZE = 25
const financeMoney = (value: number, currency = 'USD') => formatMoney(value, currency)

export default function FinanceDashboardPage() {
  const t = useT()
  const { admin } = useAdminAuth()
  const { feature } = useParams<{ feature?: string }>()
  const tab: ActiveTab = (feature && FEATURE_BY_SLUG[feature]) || 'overview'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination + server-side filters. Every value below is forwarded to the
  // backend, which paginates and filters in SQL — nothing is sliced client-side.
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Data states
  const [summary, setSummary] = useState<AdminFinancialSummary | null>(null)
  const [financeReport, setFinanceReport] = useState<FinanceDashboardReport | null>(null)
  const [breakdownItems, setBreakdownItems] = useState<FinanceBreakdownItem[]>([])
  const [breakdownGroup, setBreakdownGroup] = useState<FinanceBreakdownGroup>('shop')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [trend, setTrend] = useState<FinanceTimeseriesPoint[]>([])
  // Payment status (what the BUYER settled) and commission status (what TBK
  // collected) are separate axes; both are applied server-side.
  const [financePaymentStatus, setFinancePaymentStatus] = useState('')
  const [financeCommissionStatus, setFinanceCommissionStatus] = useState('')
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([])
  const [pointUsers, setPointUsers] = useState<AdminPointUser[]>([])
  const [sellerGrowth, setSellerGrowth] = useState<AdminSellerGrowthItem[]>([])
  const [productReviews, setProductReviews] = useState<AdminProductReviewItem[]>([])
  const [shopReviews, setShopReviews] = useState<AdminShopReviewItem[]>([])
  const [cases, setCases] = useState<AdminCaseListItem[]>([])
  const [riskEvents, setRiskEvents] = useState<AdminRiskEvent[]>([])
  const [paymentConfigs, setPaymentConfigs] = useState<AdminPaymentMethodConfig[]>([])

  // Modal / Action states
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentListItem | null>(null)
  const [selectedPointUser, setSelectedPointUser] = useState<AdminPointUser | null>(null)
  const [selectedPointAccount, setSelectedPointAccount] = useState<AdminUserPointAccount | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(100)
  const [adjustType, setAdjustType] = useState<'ADD' | 'REMOVE'>('ADD')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustingPoints, setAdjustingPoints] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  
  const [moderationReason, setModerationReason] = useState('')
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null)
  const [moderatingReviewKind, setModeratingReviewKind] = useState<'product' | 'shop'>('product')

  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [newCaseDesc, setNewCaseDesc] = useState('')
  const [newCaseType, setNewCaseType] = useState('PAYMENT_DISPUTE')
  const [newCasePriority, setNewCasePriority] = useState('HIGH')
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false)

  const [selectedCase, setSelectedCase] = useState<AdminCaseDetail | null>(null)
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false)
  const [resolutionText, setResolutionText] = useState('')
  const [newMessage, setNewMessage] = useState('')

  const [resolvingRisk, setResolvingRisk] = useState<AdminRiskEvent | null>(null)
  const [riskResolveReason, setRiskResolveReason] = useState('')

  const [paymentDetail, setPaymentDetail] = useState<AdminPaymentDetail | null>(null)
  const [pointHistory, setPointHistory] = useState<AdminPointTransaction[] | null>(null)
  const [scanningRisk, setScanningRisk] = useState(false)

  // The buyer ledger for the account being adjusted, so the admin sees what
  // they are correcting.
  useEffect(() => {
    setPointHistory(null)
    if (!selectedPointUser || selectedPointAccount?.account_type !== 'BUYER') return
    let cancelled = false
    adminFinanceApi.getBuyerPointHistory(selectedPointUser.user_id)
      .then((res) => { if (!cancelled) setPointHistory(res.history ?? []) })
      .catch(() => { if (!cancelled) setPointHistory([]) })
    return () => { cancelled = true }
  }, [selectedPointUser, selectedPointAccount])

  const handleRiskScan = async () => {
    setScanningRisk(true)
    try {
      const res = await adminFinanceApi.scanRisk()
      setActionSuccess(`Analyse des risques terminée : ${res.raised} nouvel(s) événement(s).`)
      await loadTabContent()
    } catch (err: any) {
      setError(err?.message || t('admin.finance.actionFailed'))
    } finally {
      setScanningRisk(false)
    }
  }

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const paginationLabels = {
    prev: t('admin.finance.prevPage'),
    next: t('admin.finance.nextPage'),
    range: t('admin.finance.pageRange'),
    empty: t('admin.finance.noResults')
  }

  // Switching tabs clears filters that don't apply to the new tab.
  useEffect(() => {
    setPage(1)
    setTotal(0)
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
  }, [tab])

  // Debounce typing so each keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Switching feature must not carry the previous page and filters into a
  // different dataset, which would ask for a page that does not exist there.
  useEffect(() => {
    setPage(1); setSearchInput(''); setSearch(''); setStatusFilter('')
  }, [tab])

  useEffect(() => {
    loadTabContent()
  }, [tab, page, search, statusFilter, dateRange, customFrom, customTo, breakdownGroup, financePaymentStatus, financeCommissionStatus])

  // The TBK finance panel re-reads itself so a sale verified elsewhere shows
  // up without anyone pressing Refresh. Only the overview polls: the other
  // tabs are worked on interactively and would fight a background reload.
  useEffect(() => {
    if (tab !== 'overview') return
    const refresh = () => { if (document.visibilityState === 'visible') void loadTabContent() }
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [tab, dateRange, customFrom, customTo, breakdownGroup, financePaymentStatus, financeCommissionStatus])

  // Maps a preset date range to date_from/date_to query params (inclusive,
  // local time) forwarded to the backend, which filters in SQL.
  const rangeParams = (range: typeof dateRange): { date_from?: string; date_to?: string } => {
    if (range === 'all') return {}
    if (range === 'custom') {
      // An incomplete custom range simply leaves that bound open rather than
      // silently falling back to another preset.
      return { date_from: customFrom || undefined, date_to: customTo || undefined }
    }
    const end = new Date()
    const start = new Date()
    if (range === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (range === 'week') {
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    } else {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    }
    // The calendar day as the admin sees it. toISOString() converts to UTC first,
    // which east of Greenwich turns local midnight into yesterday - so "Today"
    // used to show the previous day and none of today's sales.
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { date_from: iso(start), date_to: iso(end) }
  }

  /** The one filter every TBK finance request on this page carries, so the KPI
   *  cards, the breakdown table and the chart always describe the same rows. */
  const financeScope = () => ({
    ...rangeParams(dateRange),
    payment_status: financePaymentStatus || undefined,
    commission_status: financeCommissionStatus || undefined
  })

  const loadTabContent = async () => {
    setLoading(true)
    setError(null)
    if (tab === 'overview') { setSummary(null); setFinanceReport(null); setBreakdownItems([]); setTrend([]) }
    try {
if (tab === 'overview') {
        const scope = financeScope()
        const [sum, report, breakdown, series] = await Promise.all([
          adminFinanceApi.getSummary(),
          adminFinanceApi.getFinanceDashboard(scope),
          adminFinanceApi.getFinanceBreakdown({ ...scope, group: breakdownGroup }),
          adminFinanceApi.getFinanceTimeseries({ ...scope, interval: 'day' })
        ])
        setSummary(sum)
        setFinanceReport(report)
        setBreakdownItems(breakdown.items || [])
        setTrend(series.points || [])
      } else if (tab === 'payment_config') {
        const res = await adminFinanceApi.listPaymentConfigs()
        setPaymentConfigs(res.items || [])
      } else if (tab === 'payments') {
        const res = await adminFinanceApi.listPayments({
          page, limit: PAGE_SIZE,
          payment_status: statusFilter || undefined,
          order_number: search || undefined
        })
        setPayments(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'confirmation') {
        const res = await adminFinanceApi.listPayments({
          page, limit: PAGE_SIZE,
          payment_status: statusFilter || 'PENDING',
          order_number: search || undefined
        })
        setPayments(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'points') {
        const res = await adminFinanceApi.listPointUsers({ page, limit: PAGE_SIZE, search: search || undefined })
        setPointUsers(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'growth' || tab === 'trust') {
        const res = await adminFinanceApi.listSellerGrowth({ page, limit: PAGE_SIZE, search: search || undefined })
        setSellerGrowth(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'reviews_product') {
        const res = await adminFinanceApi.listProductReviews({ page, limit: PAGE_SIZE, status: statusFilter || undefined })
        setProductReviews(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'reviews_shop') {
        const res = await adminFinanceApi.listShopReviews({ page, limit: PAGE_SIZE, status: statusFilter || undefined })
        setShopReviews(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'cases' || tab === 'support') {
        const res = await adminFinanceApi.listCases({ page, limit: PAGE_SIZE, status: statusFilter || undefined })
        setCases(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'risk') {
        const res = await adminFinanceApi.listRiskEvents({ page, limit: PAGE_SIZE, status: statusFilter || undefined })
        setRiskEvents(res.items || [])
        setTotal(res.total || 0)
      }
    } catch (err: any) {
      setError(err?.message || t('admin.finance.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustPoints = async () => {
    if (!selectedPointUser || !selectedPointAccount || adjustReason.trim().length < 5 || adjustAmount <= 0) return
    setAdjustingPoints(true)
    setAdjustError(null)
    try {
      await adminFinanceApi.adjustUserPoints(selectedPointUser.user_id, selectedPointAccount, adjustType, adjustAmount, adjustReason.trim(), crypto.randomUUID())
      setActionSuccess(t('admin.finance.pointsAdjustedSuccess', { name: selectedPointUser.name }))
      setSelectedPointUser(null)
      setSelectedPointAccount(null)
      setAdjustReason('')
      await loadTabContent()
    } catch (err: any) {
      setAdjustError(err?.message || t('admin.finance.adjustFailed'))
    } finally {
      setAdjustingPoints(false)
    }
  }

  const savePaymentConfig = async (config: AdminPaymentMethodConfig) => {
    setError(null)
    try {
      const saved = await adminFinanceApi.updatePaymentConfig(config.code, config)
      setPaymentConfigs(items => items.map(item => item.code === saved.code ? saved : item))
      setActionSuccess(`Mode de paiement ${saved.label} enregistré`)
    } catch (err: any) {
      setError(err?.message || 'Impossible d’enregistrer la configuration')
    }
  }

  const handleModerateReview = async (id: string, kind: 'product' | 'shop', action: 'hide' | 'restore') => {
    if (action === 'hide' && !moderationReason) {
      alert(t('admin.finance.hideReasonRequired'))
      return
    }
    try {
      if (kind === 'product') {
        if (action === 'hide') {
          await adminFinanceApi.hideProductReview(id, moderationReason)
        } else {
          await adminFinanceApi.restoreProductReview(id, moderationReason || t('admin.finance.adminRestorationDefault'))
        }
      } else {
        if (action === 'hide') {
          await adminFinanceApi.hideShopReview(id, moderationReason)
        } else {
          await adminFinanceApi.restoreShopReview(id, moderationReason || t('admin.finance.adminRestorationDefault'))
        }
      }
      setActionSuccess(action === 'hide' ? t('admin.finance.reviewHiddenSuccess') : t('admin.finance.reviewRestoredSuccess'))
      setModeratingReviewId(null)
      setModerationReason('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    }
  }

  const closePaymentModal = () => {
    setSelectedPayment(null)
    setPaymentDetail(null)
  }

  const openPaymentDetail = async (p: AdminPaymentListItem) => {
    setSelectedPayment(p)
    setPaymentDetail(null)
    try {
      setPaymentDetail(await adminFinanceApi.getPaymentDetail(p.payment_id))
    } catch {
      // The modal still shows the list-row fields if the drill-down fails.
    }
  }

  const openCaseDetail = async (id: string) => {
    setLoadingCaseDetail(true)
    try {
      const detail = await adminFinanceApi.getCaseDetail(id)
      setSelectedCase(detail)
      setResolutionText('')
      setNewMessage('')
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    } finally {
      setLoadingCaseDetail(false)
    }
  }

  const handleAssignToMe = async () => {
    if (!selectedCase || !admin) return
    try {
      await adminFinanceApi.assignCase(selectedCase.id, admin.id)
      const refreshed = await adminFinanceApi.getCaseDetail(selectedCase.id)
      setSelectedCase(refreshed)
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    }
  }

  const handleResolveCase = async (status: 'RESOLVED' | 'DISMISSED') => {
    if (!selectedCase || !resolutionText.trim()) return
    try {
      await adminFinanceApi.resolveCase(selectedCase.id, status, resolutionText.trim())
      setActionSuccess(t('admin.finance.caseCreatedSuccess'))
      setSelectedCase(null)
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    }
  }

  const handleAddCaseMessage = async () => {
    if (!selectedCase || !newMessage.trim()) return
    try {
      await adminFinanceApi.addCaseMessage(selectedCase.id, 'INTERNAL_ADMIN_NOTE', newMessage.trim())
      const refreshed = await adminFinanceApi.getCaseDetail(selectedCase.id)
      setSelectedCase(refreshed)
      setNewMessage('')
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    }
  }

  const handleResolveRisk = async (status: 'RESOLVED' | 'DISMISSED') => {
    if (!resolvingRisk || !riskResolveReason.trim()) return
    try {
      await adminFinanceApi.resolveRiskEvent(resolvingRisk.id, status, riskResolveReason.trim())
      setActionSuccess(t('admin.finance.reviewRestoredSuccess'))
      setResolvingRisk(null)
      setRiskResolveReason('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.actionFailed'))
    }
  }

  const handleCreateCase = async () => {
    if (!newCaseTitle || !newCaseDesc) return
    try {
      await adminFinanceApi.createCase({
        case_type: newCaseType,
        priority: newCasePriority,
        title: newCaseTitle,
        description: newCaseDesc
      })
      setActionSuccess(t('admin.finance.caseCreatedSuccess'))
      setShowCreateCaseModal(false)
      setNewCaseTitle('')
      setNewCaseDesc('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.caseCreateFailed'))
    }
  }

  return (
    <div style={{ color: '#f8fafc' }}>
      {/* Page Header — section above, active feature as the title. */}
      <div className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">{t('admin.layout.navFinance')}</p>
          <h1>{t(FEATURE_TITLE_KEY[tab])}</h1>
          <p>{t('admin.finance.subtitle')}</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-button" onClick={() => void loadTabContent()} disabled={loading}>
            {t('admin.finance.refresh')}
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #059669', display: 'flex', justifyContent: 'space-between' }}>
          <span>✅ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #dc2626' }}>
          ⚠️ Impossible de charger les données financières. <button onClick={() => void loadTabContent()}>Réessayer</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
          {t('admin.finance.fetchingData')}
        </div>
      )}

{/* TAB 1: FINANCIAL SUMMARY OVERVIEW */}
      {!loading && tab === 'overview' && summary && (
        <div>
          {/* TBK PLATFORM FINANCE — real numbers from sale_commissions + verified payments */}
          <div style={{ border: '1px solid #4338ca', backgroundColor: '#1e1b4b', borderRadius: 10, padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#a5b4fc' }}>TBK Platform Finance — live</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['today', 'week', 'month', 'all', 'custom'] as const).map((r) => (
                  <button key={r} onClick={() => setDateRange(r)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #4338ca', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      backgroundColor: dateRange === r ? '#4f46e5' : 'transparent', color: dateRange === r ? '#fff' : '#a5b4fc' }}>
                    {r === 'today' ? 'Today' : r === 'week' ? '7 days' : r === 'month' ? 'Month' : r === 'all' ? 'All time' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Server-side filters. Every control below re-queries the backend;
                nothing on this panel is filtered in the browser. */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              {dateRange === 'custom' && (
                <>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Date de début"
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f172a', color: '#e0e7ff', fontSize: 12 }} />
                  <span style={{ color: '#818cf8', fontSize: 12 }}>→</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="Date de fin"
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f172a', color: '#e0e7ff', fontSize: 12 }} />
                </>
              )}
              <select value={financePaymentStatus} onChange={(e) => setFinancePaymentStatus(e.target.value)} aria-label="Statut de paiement"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f172a', color: '#e0e7ff', fontSize: 12 }}>
                <option value="">Paiement · tous</option>
                <option value="VERIFIED">Paiement vérifié</option>
                <option value="PAID">Payé</option>
                <option value="PENDING">En attente</option>
                <option value="CONFIRMED">Confirmé</option>
                <option value="REFUNDED">Remboursé</option>
              </select>
              <select value={financeCommissionStatus} onChange={(e) => setFinanceCommissionStatus(e.target.value)} aria-label="Statut de commission"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f172a', color: '#e0e7ff', fontSize: 12 }}>
                <option value="">Commission · toutes</option>
                <option value="DUE">Commission due</option>
                <option value="COLLECTED">Commission encaissée</option>
                <option value="WAIVED">Commission annulée</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <MetricCard title="Ventes brutes (marchandise)" value={financeReport!.totals_by_currency.map(x => financeMoney(x.gross_sales, x.currency)).join(' · ')} sub={`${financeReport!.verified_sales} sales verified`} color="#60a5fa" />
              <MetricCard title={`Commission TBK (${financeReport!.commission_rate.toFixed(2)}%)`} value={financeReport!.totals_by_currency.map(x => financeMoney(x.commission_amount, x.currency)).join(' · ')} sub="DUE / COLLECTED tracked separately" color="#f87171" />
              <MetricCard title="Revenu net vendeur" value={financeReport!.totals_by_currency.map(x => financeMoney(x.seller_net_amount, x.currency)).join(' · ')} sub={`Gross − commission`} color="#34d399" />
              {/* Cash and mobile money are reported separately: one figure for
                  both made an operator settlement indistinguishable from notes
                  handed to a courier. */}
              <MetricCard title="Espèces collectées" value={financeReport!.mixed_currency ? 'Plusieurs devises' : financeMoney(financeReport!.collected_cash, financeReport!.currency || 'USD')} sub="remises au Livreur · avec livraison" color="#fbbf24" />
              <MetricCard
                title="Mobile money collecté"
                value={financeReport!.mixed_currency ? 'Plusieurs devises' : financeMoney(financeReport!.collected_mobile ?? 0, financeReport!.currency || 'USD')}
                sub={(financeReport!.collected_by_provider ?? []).map(p => `${p.provider.replace(/_/g, ' ')} ${financeMoney(p.amount, p.currency || financeReport!.currency || 'USD')}`).join(' · ') || 'confirmé par l’opérateur'}
                color="#34d399"
              />
              <MetricCard title="Commission annulée (remboursements)" value={financeReport!.mixed_currency ? 'Plusieurs devises' : financeMoney(financeReport!.waived_commission, financeReport!.currency || 'USD')} sub={`${financeReport!.refunded_sales} refunded sales`} color="#a78bfa" />
              <MetricCard title="Ventes en attente" value={String(financeReport!.pending_orders)} sub="no verified payment yet" color="#94a3b8" />
              {/* Axe acheteur — encaissé / restant dû — distinct de l'axe
                  commission TBK (due / encaissée) au-dessus. */}
              <MetricCard title="Paiements encaissés" value={financeReport!.totals_by_currency.map(x => financeMoney(x.payments_collected, x.currency)).join(' · ') || financeMoney(financeReport!.payments_collected, financeReport!.currency || 'USD')} sub="réglés par les acheteurs" color="#facc15" />
              <MetricCard title="Paiements dus" value={financeReport!.totals_by_currency.map(x => financeMoney(x.payments_due, x.currency)).join(' · ') || financeMoney(financeReport!.payments_due, financeReport!.currency || 'USD')} sub="restant dû par les acheteurs" color="#fb923c" />
              {/* A subset of "dus", not a figure to add to it: the operator has
                  been asked and has not answered yet. */}
              <MetricCard title="Paiements en attente" value={financeMoney(financeReport!.payments_pending ?? 0, financeReport!.currency || 'USD')} sub="dont opérateur en attente de confirmation" color="#a78bfa" />
              <MetricCard title="Remboursements" value={financeMoney(financeReport!.refunded_amount ?? 0, financeReport!.currency || 'USD')} sub={`${financeReport!.refunded_sales} vente(s) remboursée(s)`} color="#f87171" />
              <MetricCard title="Unités vendues" value={String(financeReport!.units_sold)} sub="order line quantities" color="#e2e8f0" />
            </div>

            {/* Real series from /admin/finance/timeseries — no demo data. */}
            <div style={{ border: '1px solid #4338ca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc', marginBottom: 6 }}>Évolution — ventes · commission · net</div>
              <FinanceTrendChart points={trend} emptyLabel="Aucune vente sur cette période." />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['shop', 'product', 'variant', 'seller', 'business'] as const).map((g) => (
                <button key={g} onClick={() => setBreakdownGroup(g)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #4338ca', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                    backgroundColor: breakdownGroup === g ? '#312e81' : 'transparent', color: breakdownGroup === g ? '#c7d2fe' : '#818cf8' }}>
                  By {g}
                </button>
              ))}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#312e81', textAlign: 'left', color: '#c7d2fe' }}>
                  <th style={{ padding: '8px 10px' }}>Entity</th>
                  <th style={{ padding: '8px 10px' }}>Orders</th>
                  <th style={{ padding: '8px 10px' }}>Units</th>
                  <th style={{ padding: '8px 10px' }}>Gross</th>
                  <th style={{ padding: '8px 10px' }}>Commission</th>
                  <th style={{ padding: '8px 10px' }}>Seller net</th>
                  <th style={{ padding: '8px 10px' }}>Collected / Due</th>
                </tr>
              </thead>
              <tbody>
                {breakdownItems.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 12, color: '#818cf8', textAlign: 'center' }}>No sale commissions recorded in this range yet.</td></tr>
                )}
                {breakdownItems.map((item) => (
                  <tr key={`${item.id || item.label}`} style={{ borderBottom: '1px solid #4338ca' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                      {item.label}
                      {item.sub_label && <div style={{ fontSize: 10, fontWeight: 500, color: '#818cf8' }}>{item.sub_label}</div>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{item.sales_count}</td>
                    <td style={{ padding: '8px 10px' }}>{item.units_sold}</td>
                    <td style={{ padding: '8px 10px', color: '#93c5fd' }}>{financeMoney(item.gross_sales, item.currency)}</td>
                    <td style={{ padding: '8px 10px', color: '#fca5a5' }}>{financeMoney(item.commission_amount, item.currency)}</td>
                    <td style={{ padding: '8px 10px', color: '#6ee7b7' }}>{financeMoney(item.seller_net_amount, item.currency)}</td>
                    <td style={{ padding: '8px 10px', color: '#e9d5ff' }}>{financeMoney(item.collected, item.currency)} / {financeMoney(item.due, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <MetricCard title={t('admin.finance.metricGmvTitle')} value={formatMoney(summary.total_order_value)} sub={t('admin.finance.metricGmvSub', { count: summary.total_orders })} color="#60a5fa" />
            <MetricCard title={t('admin.finance.metricVerifiedTitle')} value={formatMoney(summary.verified_cash)} sub={t('admin.finance.metricVerifiedSub', { count: summary.verified_payments_count })} color="#34d399" />
            <MetricCard title={t('admin.finance.metricUnverifiedTitle')} value={formatMoney(summary.unverified_cash)} sub={t('admin.finance.metricUnverifiedSub', { count: summary.pending_payments_count })} color="#fbbf24" />
            <MetricCard title={t('admin.finance.metricDisputedTitle')} value={formatMoney(summary.disputed_cash)} sub={t('admin.finance.metricDisputedSub', { count: summary.disputed_payments_count })} color="#f87171" />
            <MetricCard title={t('admin.finance.metricPointsDiscountTitle')} value={formatMoney(summary.points_discount_value)} sub={t('admin.finance.metricPointsDiscountSub')} color="#a78bfa" />
            <MetricCard title={t('admin.finance.metricOpenCasesTitle')} value={String(summary.open_cases_count)} sub={t('admin.finance.metricOpenCasesSub')} color="#f472b6" />
            <MetricCard title={t('admin.finance.metricFlaggedReviewsTitle')} value={String(summary.flagged_reviews_count)} sub={t('admin.finance.metricFlaggedReviewsSub')} color="#fb923c" />
            <MetricCard title={t('admin.finance.metricRiskTitle')} value={String(summary.risk_alerts_count)} sub={t('admin.finance.metricRiskSub')} color="#ef4444" />
          </div>
        </div>
      )}

      {!loading && tab === 'payment_config' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {paymentConfigs.map((config, index) => (
            <div key={config.code} style={{ padding: 16, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                <label>Libellé<input value={config.label} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, label:e.target.value} : item))} /></label>
                <label>Actif<input type="checkbox" checked={config.enabled} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, enabled:e.target.checked} : item))} /></label>
                <label>Majoration<select value={config.markup_type} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, markup_type:e.target.value as AdminPaymentMethodConfig['markup_type']} : item))}><option value="NONE">Aucune</option><option value="PERCENTAGE">%</option><option value="FIXED">Fixe</option></select></label>
                <label>Valeur<input type="number" min="0" step="0.01" value={config.markup_value} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, markup_value:Number(e.target.value)} : item))} /></label>
                {/* A fixed markup is an amount, so it needs a currency; a
                    percentage is currency-free and says so instead. */}
                <label>Devise{config.markup_type === 'FIXED' ? (
                  <select value={config.markup_currency ?? 'USD'} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, markup_currency:e.target.value} : item))}>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF (héritage)</option>
                  </select>
                ) : <input value={config.markup_type === 'PERCENTAGE' ? '% — sans devise' : '—'} readOnly />}</label>
                <label>Fournisseur<input value={config.provider} onChange={e => setPaymentConfigs(items => items.map((item, i) => i === index ? {...item, provider:e.target.value} : item))} /></label>
                <button className="admin-button" onClick={() => void savePaymentConfig(config)}>Enregistrer</button>
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{config.code} · {config.timing} · {config.channel}</div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: CASH PAYMENTS */}
      {!loading && (tab === 'payments' || tab === 'confirmation') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {tab === 'confirmation' ? t('admin.layout.itemCashConfirmation') : t('admin.finance.paymentsTitle')}
            </h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('admin.finance.paymentsCount', { count: total })}</span>
          </div>

          <FilterBar
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder={t('admin.finance.searchOrderPlaceholder')}
            statusValue={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setPage(1) }}
            statusOptions={['PENDING', 'VERIFIED', 'DISPUTED']}
            statusAllLabel={t('admin.finance.allStatuses')}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.orders.colOrderNumber')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colBuyer')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colShopBusiness')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colTotalAmount')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colPaymentMethod')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colConfirmedBy')}</th>
                <th style={{ padding: '12px 14px' }}>{t('common.status')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{p.order_number}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div>{p.buyer_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{p.buyer_email}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div>{p.shop_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{p.business_name}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#34d399' }}>{formatMoney(p.total_amount)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div>{p.payment_method || '—'}</div>
                    {p.provider && <div style={{ fontSize: 11, fontWeight: 700 }}>{p.provider.replace(/_/g, ' ')}</div>}
                    {p.payment_reference && <div style={{ fontSize: 10, color: '#64748b' }}>{p.payment_reference}</div>}
                    {p.delivery_status && (
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {p.delivery_status}{p.courier_name ? ` · ${p.courier_name}` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {/* Cash is settled by the assigned courier, mobile money by the
                        operator. A settled payment naming neither is the anomaly. */}
                    <StatusBadge
                      ok={!!p.confirmation_actor && p.confirmation_actor !== 'LEGACY_DECLARATION'}
                      label={p.confirmation_actor || t('admin.finance.waiting')}
                    />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      backgroundColor: SETTLED_STATUSES.includes(p.payment_status) ? '#064e3b' : p.payment_status === 'DISPUTED' ? '#7f1d1d' : '#78350f',
                      color: SETTLED_STATUSES.includes(p.payment_status) ? '#34d399' : p.payment_status === 'DISPUTED' ? '#fca5a5' : '#fcd34d'
                    }}>
                      {p.payment_status}
                    </span>
                    {p.anomaly_flag && <span style={{ marginLeft: 6, fontSize: 12 }} title={p.anomaly_reason}>{t('admin.finance.anomalyBadge')}</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => openPaymentDetail(p)}
                      style={{ padding: '4px 10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      {t('admin.finance.inspect')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 3: BUYER POINTS LEDGER */}
      {!loading && tab === 'points' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.pointsTitle')}</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('admin.finance.pointsCount', { count: total })}</span>
          </div>

          <FilterBar
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder={t('admin.finance.searchBuyerPlaceholder')}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colBuyerName')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.email')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colCurrentLevel')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colAvailablePoints')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colReservedPoints')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colLifetimePoints')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pointUsers.flatMap((u) => u.accounts.map((account) => ({ u, account }))).map(({ u, account }) => (
                <tr key={`${u.user_id}-${account.account_type}-${account.business_id || 'buyer'}`} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                    <div>{u.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{u.user_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ backgroundColor: '#1e293b', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {account.account_type === 'BUYER' ? 'BUYER POINTS' : `SELLER POINTS — ${account.business_name}`}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60a5fa' }}>{t('admin.finance.ptsAmount', { value: account.current_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{t('admin.finance.ptsAmount', { value: account.reserved_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px', color: '#a78bfa' }}>{t('admin.finance.ptsAmount', { value: account.lifetime_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setSelectedPointUser(u); setSelectedPointAccount(account); setAdjustError(null) }}
                        style={{ padding: '4px 10px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        {t('admin.finance.adjustPointsBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 4: SELLER GROWTH */}
      {!loading && (tab === 'growth' || tab === 'trust') && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>
            {tab === 'trust' ? t('admin.layout.itemTrust') : t('admin.finance.growthTitle')}
          </h3>
          <FilterBar
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder={t('admin.finance.searchSellerPlaceholder')}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colSellerBusiness')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colLevel')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colCompletedGmv')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colRating')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colCashRate')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colTrustStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {/* One row per seller-business pair, so the seller id alone is not unique. */}
              {sellerGrowth.map((s) => (
                <tr key={`${s.seller_id}-${s.business_id}`} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{s.seller_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{s.business_name} {t('admin.finance.shopsCount', { count: s.shop_count })}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 700 }}>{s.level}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#34d399' }}>{formatMoney(s.total_gmv)}</td>
                  <td style={{ padding: '12px 14px' }}>{t('admin.finance.ratingDisplay', { rating: s.average_rating.toFixed(1), count: s.review_count })}</td>
                  <td style={{ padding: '12px 14px' }}>{s.cash_confirmation_rate}%</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: s.trust_status === 'TRUSTED' ? '#064e3b' : '#7f1d1d', color: s.trust_status === 'TRUSTED' ? '#34d399' : '#fca5a5' }}>
                      {s.trust_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 5: PRODUCT REVIEWS MODERATION */}
      {!loading && tab === 'reviews_product' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.reviewsProductTitle')}</h3>
          <FilterBar
            statusValue={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setPage(1) }}
            statusOptions={['VISIBLE', 'FLAGGED', 'UNDER_REVIEW', 'HIDDEN']}
            statusAllLabel={t('admin.finance.allStatuses')}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colProduct')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colBuyer')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colRating')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colComment')}</th>
                <th style={{ padding: '12px 14px' }}>{t('common.status')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {productReviews.map((r) => (
                <tr key={r.review_id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{r.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.shop_name}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{r.buyer_name}</td>
                  <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 700 }}>{'⭐'.repeat(r.rating)}</td>
                  <td style={{ padding: '12px 14px', maxWidth: 300, color: '#cbd5e1' }}>{r.comment}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: r.moderation_status === 'HIDDEN' ? '#7f1d1d' : '#064e3b', color: r.moderation_status === 'HIDDEN' ? '#fca5a5' : '#34d399' }}>
                      {r.moderation_status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {r.moderation_status === 'HIDDEN' ? (
                      <button onClick={() => handleModerateReview(r.review_id, 'product', 'restore')} style={{ padding: '4px 10px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.common.restore')}
                      </button>
                    ) : (
                      <button onClick={() => { setModeratingReviewId(r.review_id); setModeratingReviewKind('product') }} style={{ padding: '4px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.finance.hideBtn')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 6: SHOP REVIEWS */}
      {!loading && tab === 'reviews_shop' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.reviewsShopTitle')}</h3>
          <FilterBar
            statusValue={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setPage(1) }}
            statusOptions={['VISIBLE', 'FLAGGED', 'UNDER_REVIEW', 'HIDDEN']}
            statusAllLabel={t('admin.finance.allStatuses')}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.shopColumn')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colBuyer')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colRating')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colComment')}</th>
                <th style={{ padding: '12px 14px' }}>{t('common.status')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shopReviews.map((r) => (
                <tr key={r.review_id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{r.shop_name}</td>
                  <td style={{ padding: '12px 14px' }}>{r.buyer_name}</td>
                  <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 700 }}>{'⭐'.repeat(r.rating)}</td>
                  <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>{r.comment}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: r.moderation_status === 'HIDDEN' ? '#7f1d1d' : '#064e3b', color: r.moderation_status === 'HIDDEN' ? '#fca5a5' : '#34d399' }}>
                      {r.moderation_status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {r.moderation_status === 'HIDDEN' ? (
                      <button onClick={() => handleModerateReview(r.review_id, 'shop', 'restore')} style={{ padding: '4px 10px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.common.restore')}
                      </button>
                    ) : (
                      <button onClick={() => { setModeratingReviewId(r.review_id); setModeratingReviewKind('shop') }} style={{ padding: '4px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.finance.hideBtn')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 7: CASES & DISPUTES */}
      {!loading && (tab === 'cases' || tab === 'support') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {tab === 'support' ? t('admin.layout.itemSupport') : t('admin.finance.casesTitle')}
            </h3>
            <button onClick={() => setShowCreateCaseModal(true)} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {t('admin.finance.openNewCase')}
            </button>
          </div>

          <FilterBar
            statusValue={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setPage(1) }}
            statusOptions={['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_ADMIN', 'RESOLVED', 'DISMISSED']}
            statusAllLabel={t('admin.finance.allStatuses')}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colCaseNumber')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colType')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colTitle')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colPriority')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colAssignedAdmin')}</th>
                <th style={{ padding: '12px 14px' }}>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} onClick={() => openCaseDetail(c.id)} style={{ borderBottom: '1px solid #1e293b', fontSize: 13, cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{c.case_number}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#94a3b8' }}>{c.case_type}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{c.title}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: c.priority === 'HIGH' || c.priority === 'URGENT' ? '#7f1d1d' : '#1e293b', color: c.priority === 'HIGH' || c.priority === 'URGENT' ? '#fca5a5' : '#94a3b8' }}>
                      {c.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>{c.assigned_admin || t('admin.finance.unassigned')}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: c.status === 'RESOLVED' ? '#064e3b' : '#78350f', color: c.status === 'RESOLVED' ? '#34d399' : '#fcd34d' }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* TAB 8: FRAUD & RISK */}
      {!loading && tab === 'risk' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.riskTitle')}</h3>
            <button className="admin-button" onClick={() => void handleRiskScan()} disabled={scanningRisk}>
              {scanningRisk ? 'Analyse…' : 'Analyser maintenant'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
            Règles automatiques (toutes les 5 min) : commandes bloquées, litiges répétés, taux d’annulation, stock incohérent, paiement réglé sans confirmation. Seuils : Configuration globale.
          </p>
          <FilterBar
            statusValue={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setPage(1) }}
            statusOptions={['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']}
            statusAllLabel={t('admin.finance.allStatuses')}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colEventType')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colSeverity')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colTargetName')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colRuleCode')}</th>
                <th style={{ padding: '12px 14px' }}>{t('common.status')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {riskEvents.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{r.event_type}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: r.severity === 'CRITICAL' ? '#7f1d1d' : '#78350f', color: r.severity === 'CRITICAL' ? '#fca5a5' : '#fcd34d' }}>
                      {r.severity}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{r.target_name} ({r.target_type})</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>{r.rule_code}</td>
                  <td style={{ padding: '12px 14px' }}>{r.status}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {(r.status === 'OPEN' || r.status === 'INVESTIGATING') ? (
                      <button onClick={() => setResolvingRisk(r)} style={{ padding: '4px 10px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.finance.resolveBtn')}
                      </button>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} labels={paginationLabels} />
        </div>
      )}

      {/* CASH PAYMENT INSPECTION MODAL */}
      {selectedPayment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.paymentDetailTitle', { number: selectedPayment.order_number })}</h3>
              <button onClick={() => closePaymentModal()} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelBuyer')}</span>
                <span style={{ fontWeight: 700 }}>{selectedPayment.buyer_name} ({selectedPayment.buyer_email})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelMerchant')}</span>
                <span style={{ fontWeight: 700 }}>{selectedPayment.shop_name} ({selectedPayment.business_name})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelSubtotal')}</span>
                <span>{formatMoney(selectedPayment.subtotal_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelPointsDiscount')}</span>
                <span style={{ color: '#a78bfa' }}>-{formatMoney(selectedPayment.points_discount_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelDeliveryFee')}</span>
                <span>+{formatMoney(selectedPayment.delivery_fee)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid #334155', paddingTop: 8, marginTop: 6, color: '#34d399' }}>
                <span>{t('admin.finance.labelCashDue')}</span>
                <span>{formatMoney(selectedPayment.cash_due)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#fbbf24' }}>{t('admin.finance.settlementTitle')}</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>{t('admin.finance.labelPaymentMethod')}</span>
                <span style={{ fontWeight: 700 }}>{selectedPayment.payment_method || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>{t('admin.finance.labelConfirmedBy')}</span>
                <StatusBadge
                  ok={!!selectedPayment.confirmation_actor && selectedPayment.confirmation_actor !== 'LEGACY_DECLARATION'}
                  label={selectedPayment.confirmation_actor
                    ? t('admin.finance.confirmedAtTime', { time: selectedPayment.paid_at ? new Date(selectedPayment.paid_at).toLocaleTimeString() : selectedPayment.confirmation_actor })
                    : t('admin.finance.waiting')}
                />
              </div>
              {/* Kept visible for rows written before the courier became the cash
                  authority, so Finance can still audit that history. */}
              {(selectedPayment.buyer_confirmed_paid || selectedPayment.seller_confirmed_received) && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                  {t('admin.finance.legacyDeclarationNote')}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 8 }}>
                <span>{t('admin.finance.labelAuthoritativeStatus')}</span>
                <span style={{ fontWeight: 700, color: SETTLED_STATUSES.includes(selectedPayment.payment_status) ? '#34d399' : '#fcd34d' }}>{selectedPayment.payment_status}</span>
              </div>
            </div>

            {/* TBK PLATFORM COMMISSION BREAKDOWN */}
            {(() => {
              const grossBase = Math.max(0, (selectedPayment.subtotal_amount || 0) - (selectedPayment.points_discount_amount || 0))
              const commissionRate = financeReport && financeReport.commission_rate > 0
                ? financeReport.commission_rate / 100
                : 0
              const estCommission = grossBase * commissionRate
              const estNet = grossBase - estCommission
              const isVerified = selectedPayment.payment_status === 'VERIFIED'
              return (
                <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #4338ca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#a5b4fc' }}>COMMISSION PLATEFORME TBK</h4>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, backgroundColor: isVerified ? '#065f46' : '#78350f', color: isVerified ? '#6ee7b7' : '#fde68a' }}>
                      {isVerified ? 'VERIFIÉE · À REVERSER' : 'EN ATTENTE DE VERIFICATION'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Vente brute éligible</div>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{formatMoney(grossBase)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Taux de commission</div>
                      <div style={{ fontWeight: 700, color: '#a5b4fc' }}>{commissionRate > 0 ? `${(commissionRate * 100).toFixed(2)}%` : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Commission TBK</div>
                      <div style={{ fontWeight: 700, color: '#f87171' }}>{formatMoney(estCommission)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Revenu net vendeur</div>
                      <div style={{ fontWeight: 700, color: '#34d399' }}>{formatMoney(estNet)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, borderTop: '1px solid #312e81', paddingTop: 6 }}>
                    Frais de livraison ({formatMoney(selectedPayment.delivery_fee)}) exclus de l'assiette de commission TBK.
                  </div>
                </div>
              )
            })()}

            {paymentDetail && paymentDetail.product_lines?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{t('admin.finance.orderLinesTitle')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {paymentDetail.product_lines.map((line) => (
                    <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {lineLabel(line.product_name, line.variant_name)} × {line.quantity}
                      </span>
                      <span style={{ fontWeight: 700 }}>{formatMoney(line.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {paymentDetail && paymentDetail.order_history?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{t('admin.finance.orderHistoryTitle')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                  {paymentDetail.order_history.map((h, i) => (
                    <div key={`${h.status}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#cbd5e1' }}>
                      <span>{h.status}{h.note ? ` — ${h.note}` : ''}</span>
                      <span style={{ color: '#64748b', flexShrink: 0 }}>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPayment.anomaly_flag && (
              <div style={{ backgroundColor: '#78350f', border: '1px solid #d97706', color: '#fef3c7', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                {t('admin.finance.anomalyDetected', { reason: selectedPayment.anomaly_reason })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setNewCaseTitle(t('admin.finance.disputeCaseTitleTemplate', { number: selectedPayment.order_number }))
                  setNewCaseDesc(t('admin.finance.disputeCaseDescTemplate', {
                    number: selectedPayment.order_number,
                    buyerConfirmed: selectedPayment.buyer_confirmed_paid ? t('common.yes') : t('common.no'),
                    sellerConfirmed: selectedPayment.seller_confirmed_received ? t('common.yes') : t('common.no'),
                    amount: selectedPayment.cash_due.toFixed(2)
                  }))
                  setNewCaseType('PAYMENT_DISPUTE')
                  closePaymentModal()
                  setShowCreateCaseModal(true)
                }}
                style={{ padding: '8px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                {t('admin.finance.openDisputeCase')}
              </button>
              <button onClick={() => closePaymentModal()} style={{ padding: '8px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST POINTS MODAL */}
      {selectedPointUser && selectedPointAccount && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.adjustPointsTitle', { name: selectedPointUser.name })}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 4px' }}>{selectedPointUser.email}</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>{selectedPointUser.user_id}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Point account</label>
              <select value={`${selectedPointAccount.account_type}:${selectedPointAccount.business_id || ''}`} onChange={(e) => { const found=selectedPointUser.accounts.find((a) => `${a.account_type}:${a.business_id || ''}`===e.target.value); if(found) setSelectedPointAccount(found) }} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                {selectedPointUser.accounts.map((a) => <option key={`${a.account_type}:${a.business_id || ''}`} value={`${a.account_type}:${a.business_id || ''}`}>{a.account_type === 'BUYER' ? 'Buyer Points' : `Seller Points — ${a.business_name}`}</option>)}
              </select>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>{t('admin.finance.currentAvailable', { points: selectedPointAccount.current_points })}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelAdjustAction')}</label>
              <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="ADD">{t('admin.finance.optAddPoints')}</option>
                <option value="REMOVE">{t('admin.finance.optDeductPoints')}</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelAmount')}</label>
              <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelJustification')}</label>
              <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder={t('admin.finance.justificationPlaceholder')} />
            </div>

            {adjustError && <div style={{ color: '#fca5a5', background: '#7f1d1d', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>{adjustError}</div>}

            {selectedPointAccount.account_type === 'BUYER' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Derniers mouvements</div>
                {pointHistory === null ? <div style={{ fontSize: 12, color: '#64748b' }}>Chargement…</div>
                  : pointHistory.length === 0 ? <div style={{ fontSize: 12, color: '#64748b' }}>Aucun mouvement.</div>
                  : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 140, overflowY: 'auto', fontSize: 12 }}>
                      {pointHistory.slice(0, 20).map((h) => (
                        <li key={h.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                          <span>{new Date(h.created_at).toLocaleDateString()} · {h.reason}{h.order_number ? ` · ${h.order_number}` : ''}</span>
                          <span style={{ color: h.type === 'CREDIT' ? '#4ade80' : '#f87171', fontWeight: 700 }}>{h.type === 'CREDIT' ? '+' : '−'}{Math.abs(h.amount)} → {h.balance_after}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedPointUser(null); setSelectedPointAccount(null) }} disabled={adjustingPoints} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleAdjustPoints} disabled={adjustingPoints || adjustAmount <= 0 || adjustReason.trim().length < 5} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, opacity: adjustingPoints ? .6 : 1 }}>{adjustingPoints ? '…' : t('admin.finance.confirmAudit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* HIDE REVIEW MODAL */}
      {moderatingReviewId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{t('admin.finance.hideReviewTitle')}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>{t('admin.finance.hideReviewDesc')}</p>

            <textarea value={moderationReason} onChange={(e) => setModerationReason(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6, marginBottom: 20 }} placeholder={t('admin.finance.hideReasonPlaceholder')} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModeratingReviewId(null)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={() => handleModerateReview(moderatingReviewId, moderatingReviewKind, 'hide')} style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>{t('admin.finance.hideReviewBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CASE DETAIL DRAWER */}
      {(selectedCase || loadingCaseDetail) && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
            {loadingCaseDetail || !selectedCase ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>⏳ {t('admin.finance.fetchingData')}</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedCase.case_number} — {selectedCase.title}</h3>
                  <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: '#1e293b', color: '#94a3b8' }}>{selectedCase.case_type}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: selectedCase.priority === 'HIGH' || selectedCase.priority === 'URGENT' ? '#7f1d1d' : '#1e293b', color: selectedCase.priority === 'HIGH' || selectedCase.priority === 'URGENT' ? '#fca5a5' : '#94a3b8' }}>{selectedCase.priority}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: selectedCase.status === 'RESOLVED' ? '#064e3b' : '#78350f', color: selectedCase.status === 'RESOLVED' ? '#34d399' : '#fcd34d' }}>{selectedCase.status}</span>
                </div>

                <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8' }}>{t('admin.finance.colAssignedAdmin')}</span>
                    <span style={{ fontWeight: 700 }}>{selectedCase.assigned_admin || t('admin.finance.unassigned')}</span>
                  </div>
                  {selectedCase.buyer_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.finance.colBuyer')}</span>
                      <span>{selectedCase.buyer_name}</span>
                    </div>
                  )}
                  {selectedCase.order_number && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.orders.colOrderNumber')}</span>
                      <span>{selectedCase.order_number}</span>
                    </div>
                  )}
                </div>

                {selectedCase.status !== 'RESOLVED' && selectedCase.status !== 'DISMISSED' && !selectedCase.assigned_admin_id && (
                  <button onClick={handleAssignToMe} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                    {t('admin.finance.assignToMeBtn')}
                  </button>
                )}

                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{t('admin.finance.caseMessagesTitle')}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {selectedCase.messages && selectedCase.messages.length > 0 ? selectedCase.messages.map((m) => (
                      <div key={m.id} style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
                          <span>{m.sender_name || m.sender_type}</span>
                          <span>{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#cbd5e1' }}>{m.message}</div>
                      </div>
                    )) : (
                      <div style={{ color: '#64748b', fontSize: 12 }}>{t('admin.finance.noMessages')}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('admin.finance.addNotePlaceholder')}
                      style={{ flex: 1, padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12 }}
                    />
                    <button onClick={handleAddCaseMessage} style={{ padding: '8px 12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                      {t('admin.finance.addNoteBtn')}
                    </button>
                  </div>
                </div>

                {selectedCase.status !== 'RESOLVED' && selectedCase.status !== 'DISMISSED' && (
                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: 14 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{t('admin.finance.resolveCaseTitle')}</h4>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      rows={2}
                      placeholder={t('admin.finance.resolutionPlaceholder')}
                      style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6, marginBottom: 10, fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleResolveCase('DISMISSED')} disabled={!resolutionText.trim()} style={{ padding: '8px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {t('admin.finance.dismissCaseBtn')}
                      </button>
                      <button onClick={() => handleResolveCase('RESOLVED')} disabled={!resolutionText.trim()} style={{ padding: '8px 14px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {t('admin.finance.resolveCaseBtn')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* RESOLVE RISK EVENT MODAL */}
      {resolvingRisk && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.resolveRiskTitle')}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>{resolvingRisk.event_type} — {resolvingRisk.target_name}</p>
            <textarea
              value={riskResolveReason}
              onChange={(e) => setRiskResolveReason(e.target.value)}
              rows={3}
              placeholder={t('admin.finance.resolutionPlaceholder')}
              style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setResolvingRisk(null)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={() => handleResolveRisk('DISMISSED')} disabled={!riskResolveReason.trim()} style={{ padding: '8px 16px', backgroundColor: '#78350f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('admin.finance.dismissCaseBtn')}</button>
              <button onClick={() => handleResolveRisk('RESOLVED')} disabled={!riskResolveReason.trim()} style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>{t('admin.finance.resolveBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CASE MODAL */}
      {showCreateCaseModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 450 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.createCaseTitle')}</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelCaseType')}</label>
              <select value={newCaseType} onChange={(e) => setNewCaseType(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="PAYMENT_DISPUTE">PAYMENT_DISPUTE</option>
                <option value="ORDER_CLAIM">ORDER_CLAIM</option>
                <option value="PRODUCT_REPORT">PRODUCT_REPORT</option>
                <option value="REVIEW_REPORT">REVIEW_REPORT</option>
                <option value="SUPPORT_REQUEST">SUPPORT_REQUEST</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelPriority')}</label>
              <select value={newCasePriority} onChange={(e) => setNewCasePriority(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelTitle')}</label>
              <input type="text" value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder={t('admin.finance.titlePlaceholder')} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('admin.finance.labelDescription')}</label>
              <textarea value={newCaseDesc} onChange={(e) => setNewCaseDesc(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder={t('admin.finance.descPlaceholder')} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateCaseModal(false)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleCreateCase} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>{t('admin.finance.createCaseBtn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterBar({
  searchValue, onSearchChange, searchPlaceholder,
  statusValue, onStatusChange, statusOptions, statusAllLabel
}: {
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  statusValue?: string
  onStatusChange?: (v: string) => void
  statusOptions?: string[]
  statusAllLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      {onSearchChange && (
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ flex: '1 1 220px', minWidth: 200, padding: '8px 10px', backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: 6, fontSize: 13 }}
        />
      )}
      {onStatusChange && statusOptions && (
        <select
          value={statusValue}
          onChange={(e) => onStatusChange(e.target.value)}
          style={{ padding: '8px 10px', backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: 6, fontSize: 13 }}
        >
          <option value="">{statusAllLabel}</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
    </div>
  )
}

function Pagination({ page, total, pageSize, onPage, labels }: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  labels: { prev: string; next: string; range: string; empty: string }
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) {
    return <div style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>{labels.empty}</div>
  }
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>
        {labels.range.replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(total))}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          style={{ padding: '6px 12px', backgroundColor: page <= 1 ? '#1e293b' : '#334155', color: page <= 1 ? '#475569' : '#f8fafc', border: 'none', borderRadius: 6, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}
        >
          {labels.prev}
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= lastPage}
          style={{ padding: '6px 12px', backgroundColor: page >= lastPage ? '#1e293b' : '#334155', color: page >= lastPage ? '#475569' : '#f8fafc', border: 'none', borderRadius: 6, cursor: page >= lastPage ? 'default' : 'pointer', fontSize: 12 }}
        >
          {labels.next}
        </button>
      </div>
    </div>
  )
}

function MetricCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
    </div>
  )
}
