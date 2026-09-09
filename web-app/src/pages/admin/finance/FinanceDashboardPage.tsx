import { useState, useEffect } from 'react'
import {
  adminFinanceApi,
  AdminFinancialSummary,
  AdminPaymentListItem,
  AdminBuyerPointsItem,
  AdminSellerGrowthItem,
  AdminProductReviewItem,
  AdminShopReviewItem,
  AdminCaseListItem,
  AdminCaseDetail,
  AdminPaymentDetail,
  AdminPointTransaction,
  AdminRiskEvent
} from '../../../api/admin'
import { useT } from '@/store/i18n'
import { useAdminAuth } from '@/store/adminAuth'

type ActiveTab = 'overview' | 'payments' | 'points' | 'growth' | 'reviews_product' | 'reviews_shop' | 'cases' | 'risk'

const PAGE_SIZE = 25

export default function FinanceDashboardPage() {
  const t = useT()
  const { admin } = useAdminAuth()
  const [tab, setTab] = useState<ActiveTab>('overview')
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
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([])
  const [buyerPoints, setBuyerPoints] = useState<AdminBuyerPointsItem[]>([])
  const [sellerGrowth, setSellerGrowth] = useState<AdminSellerGrowthItem[]>([])
  const [productReviews, setProductReviews] = useState<AdminProductReviewItem[]>([])
  const [shopReviews, setShopReviews] = useState<AdminShopReviewItem[]>([])
  const [cases, setCases] = useState<AdminCaseListItem[]>([])
  const [riskEvents, setRiskEvents] = useState<AdminRiskEvent[]>([])

  // Modal / Action states
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentListItem | null>(null)
  const [selectedBuyer, setSelectedBuyer] = useState<AdminBuyerPointsItem | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(100)
  const [adjustType, setAdjustType] = useState<'ADD' | 'REMOVE'>('ADD')
  const [adjustReason, setAdjustReason] = useState('')
  
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
  const [historyBuyer, setHistoryBuyer] = useState<AdminBuyerPointsItem | null>(null)
  const [pointHistory, setPointHistory] = useState<AdminPointTransaction[] | null>(null)

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

  useEffect(() => {
    loadTabContent()
  }, [tab, page, search, statusFilter])

  const loadTabContent = async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'overview') {
        const sum = await adminFinanceApi.getSummary()
        setSummary(sum)
      } else if (tab === 'payments') {
        const res = await adminFinanceApi.listPayments({
          page, limit: PAGE_SIZE,
          payment_status: statusFilter || undefined,
          order_number: search || undefined
        })
        setPayments(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'points') {
        const res = await adminFinanceApi.listBuyerPoints({ page, limit: PAGE_SIZE, search: search || undefined })
        setBuyerPoints(res.items || [])
        setTotal(res.total || 0)
      } else if (tab === 'growth') {
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
      } else if (tab === 'cases') {
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
    if (!selectedBuyer || !adjustReason) return
    try {
      await adminFinanceApi.adjustBuyerPoints(selectedBuyer.buyer_id, adjustType, adjustAmount, adjustReason)
      setActionSuccess(t('admin.finance.pointsAdjustedSuccess', { name: selectedBuyer.buyer_name }))
      setSelectedBuyer(null)
      setAdjustReason('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || t('admin.finance.adjustFailed'))
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

  const openPointHistory = async (b: AdminBuyerPointsItem) => {
    setHistoryBuyer(b)
    setPointHistory(null)
    try {
      const res = await adminFinanceApi.getBuyerPointHistory(b.buyer_id)
      setPointHistory(res.history || [])
    } catch (err: any) {
      setPointHistory([])
      alert(err?.message || t('admin.finance.actionFailed'))
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
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>💰</span> {t('admin.finance.title')}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          {t('admin.finance.subtitle')}
        </p>
      </div>

      {actionSuccess && (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #059669', display: 'flex', justifyContent: 'space-between' }}>
          <span>✅ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #dc2626' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #1e293b', paddingBottom: 12, marginBottom: 20 }}>
        {[
          { id: 'overview', label: t('admin.finance.tabOverview') },
          { id: 'payments', label: t('admin.finance.tabPayments') },
          { id: 'points', label: t('admin.finance.tabPoints') },
          { id: 'growth', label: t('admin.finance.tabGrowth') },
          { id: 'reviews_product', label: t('admin.finance.tabReviewsProduct') },
          { id: 'reviews_shop', label: t('admin.finance.tabReviewsShop') },
          { id: 'cases', label: t('admin.finance.tabCases') },
          { id: 'risk', label: t('admin.finance.tabRisk') },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id as ActiveTab)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: tab === tabItem.id ? '#2563eb' : '#0f172a',
              color: tab === tabItem.id ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
          {t('admin.finance.fetchingData')}
        </div>
      )}

      {/* TAB 1: FINANCIAL SUMMARY OVERVIEW */}
      {!loading && tab === 'overview' && summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <MetricCard title={t('admin.finance.metricGmvTitle')} value={`$${summary.total_order_value.toFixed(2)}`} sub={t('admin.finance.metricGmvSub', { count: summary.total_orders })} color="#60a5fa" />
            <MetricCard title={t('admin.finance.metricVerifiedTitle')} value={`$${summary.verified_cash.toFixed(2)}`} sub={t('admin.finance.metricVerifiedSub', { count: summary.verified_payments_count })} color="#34d399" />
            <MetricCard title={t('admin.finance.metricUnverifiedTitle')} value={`$${summary.unverified_cash.toFixed(2)}`} sub={t('admin.finance.metricUnverifiedSub', { count: summary.pending_payments_count })} color="#fbbf24" />
            <MetricCard title={t('admin.finance.metricDisputedTitle')} value={`$${summary.disputed_cash.toFixed(2)}`} sub={t('admin.finance.metricDisputedSub', { count: summary.disputed_payments_count })} color="#f87171" />
            <MetricCard title={t('admin.finance.metricPointsDiscountTitle')} value={`$${summary.points_discount_value.toFixed(2)}`} sub={t('admin.finance.metricPointsDiscountSub')} color="#a78bfa" />
            <MetricCard title={t('admin.finance.metricOpenCasesTitle')} value={String(summary.open_cases_count)} sub={t('admin.finance.metricOpenCasesSub')} color="#f472b6" />
            <MetricCard title={t('admin.finance.metricFlaggedReviewsTitle')} value={String(summary.flagged_reviews_count)} sub={t('admin.finance.metricFlaggedReviewsSub')} color="#fb923c" />
            <MetricCard title={t('admin.finance.metricRiskTitle')} value={String(summary.risk_alerts_count)} sub={t('admin.finance.metricRiskSub')} color="#ef4444" />
          </div>
        </div>
      )}

      {/* TAB 2: CASH PAYMENTS */}
      {!loading && tab === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.paymentsTitle')}</h3>
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
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colBuyerPaid')}</th>
                <th style={{ padding: '12px 14px' }}>{t('admin.finance.colSellerRecv')}</th>
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
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#34d399' }}>${p.total_amount.toFixed(2)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge ok={p.buyer_confirmed_paid} label={p.buyer_confirmed_paid ? t('admin.finance.confirmed') : t('admin.finance.waiting')} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge ok={p.seller_confirmed_received} label={p.seller_confirmed_received ? t('admin.finance.confirmed') : t('admin.finance.waiting')} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      backgroundColor: p.payment_status === 'VERIFIED' ? '#064e3b' : p.payment_status === 'DISPUTED' ? '#7f1d1d' : '#78350f',
                      color: p.payment_status === 'VERIFIED' ? '#34d399' : p.payment_status === 'DISPUTED' ? '#fca5a5' : '#fcd34d'
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
              {buyerPoints.map((b) => (
                <tr key={b.buyer_id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{b.buyer_name}</td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{b.buyer_email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ backgroundColor: '#1e293b', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {b.current_level}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60a5fa' }}>{t('admin.finance.ptsAmount', { value: b.available_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{t('admin.finance.ptsAmount', { value: b.reserved_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px', color: '#a78bfa' }}>{t('admin.finance.ptsAmount', { value: b.lifetime_points.toLocaleString() })}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setSelectedBuyer(b)}
                        style={{ padding: '4px 10px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        {t('admin.finance.adjustPointsBtn')}
                      </button>
                      <button
                        onClick={() => openPointHistory(b)}
                        style={{ padding: '4px 10px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        {t('admin.finance.historyBtn')}
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
      {!loading && tab === 'growth' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.growthTitle')}</h3>
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
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#34d399' }}>${s.total_gmv.toFixed(2)}</td>
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
      {!loading && tab === 'cases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.casesTitle')}</h3>
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
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.riskTitle')}</h3>
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
                <span>${selectedPayment.subtotal_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelPointsDiscount')}</span>
                <span style={{ color: '#a78bfa' }}>-${selectedPayment.points_discount_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>{t('admin.finance.labelDeliveryFee')}</span>
                <span>+${selectedPayment.delivery_fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid #334155', paddingTop: 8, marginTop: 6, color: '#34d399' }}>
                <span>{t('admin.finance.labelCashDue')}</span>
                <span>${selectedPayment.cash_due.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#fbbf24' }}>{t('admin.finance.doubleConfirmTitle')}</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>{t('admin.finance.labelBuyerConfirmed')}</span>
                <StatusBadge ok={selectedPayment.buyer_confirmed_paid} label={selectedPayment.buyer_confirmed_paid ? t('admin.finance.confirmedAtTime', { time: selectedPayment.buyer_confirmed_at ? new Date(selectedPayment.buyer_confirmed_at).toLocaleTimeString() : '' }) : t('admin.finance.waiting')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>{t('admin.finance.labelSellerConfirmed')}</span>
                <StatusBadge ok={selectedPayment.seller_confirmed_received} label={selectedPayment.seller_confirmed_received ? t('admin.finance.confirmedAtTime', { time: selectedPayment.seller_confirmed_at ? new Date(selectedPayment.seller_confirmed_at).toLocaleTimeString() : '' }) : t('admin.finance.waiting')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 8 }}>
                <span>{t('admin.finance.labelAuthoritativeStatus')}</span>
                <span style={{ fontWeight: 700, color: selectedPayment.payment_status === 'VERIFIED' ? '#34d399' : '#fcd34d' }}>{selectedPayment.payment_status}</span>
              </div>
            </div>

            {paymentDetail && paymentDetail.product_lines?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{t('admin.finance.orderLinesTitle')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {paymentDetail.product_lines.map((line) => (
                    <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {line.product_name}{line.variant_name ? ` · ${line.variant_name}` : ''} × {line.quantity}
                      </span>
                      <span style={{ fontWeight: 700 }}>${line.total_price.toFixed(2)}</span>
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
      {selectedBuyer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{t('admin.finance.adjustPointsTitle', { name: selectedBuyer.buyer_name })}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>{t('admin.finance.currentAvailable', { points: selectedBuyer.available_points })}</p>

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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedBuyer(null)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleAdjustPoints} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>{t('admin.finance.confirmAudit')}</button>
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

      {/* BUYER POINT HISTORY MODAL */}
      {historyBuyer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('admin.finance.pointHistoryTitle', { name: historyBuyer.buyer_name })}</h3>
              <button onClick={() => { setHistoryBuyer(null); setPointHistory(null) }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {pointHistory === null ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>⏳ {t('admin.finance.fetchingData')}</div>
            ) : pointHistory.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>{t('admin.finance.noPointHistory')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '8px 10px' }}>{t('admin.finance.colType')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('admin.finance.labelAmount')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('admin.finance.colBalanceAfter')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('admin.finance.colComment')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('admin.technical.colTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pointHistory.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{tx.type}</td>
                      {/* points_change is stored unsigned; the direction lives in `type`. */}
                      <td style={{ padding: '8px 10px', color: tx.type === 'DEBIT' ? '#f87171' : '#34d399', fontWeight: 700 }}>
                        {tx.type === 'DEBIT' ? '−' : '+'}{Math.abs(tx.amount)}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{tx.balance_after}</td>
                      <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                        {tx.reason}{tx.order_number ? ` (${tx.order_number})` : ''}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      backgroundColor: ok ? '#064e3b' : '#78350f',
      color: ok ? '#34d399' : '#fcd34d'
    }}>
      {label}
    </span>
  )
}
