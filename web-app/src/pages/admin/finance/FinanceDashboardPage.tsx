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
  AdminRiskEvent
} from '../../../api/admin'

type ActiveTab = 'overview' | 'payments' | 'points' | 'growth' | 'reviews_product' | 'reviews_shop' | 'cases' | 'risk'

export default function FinanceDashboardPage() {
  const [tab, setTab] = useState<ActiveTab>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [newCaseDesc, setNewCaseDesc] = useState('')
  const [newCaseType, setNewCaseType] = useState('PAYMENT_DISPUTE')
  const [newCasePriority, setNewCasePriority] = useState('HIGH')
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false)

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadTabContent()
  }, [tab])

  const loadTabContent = async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'overview') {
        const sum = await adminFinanceApi.getSummary()
        setSummary(sum)
      } else if (tab === 'payments') {
        const res = await adminFinanceApi.listPayments({ limit: 50 })
        setPayments(res.items || [])
      } else if (tab === 'points') {
        const res = await adminFinanceApi.listBuyerPoints({ limit: 50 })
        setBuyerPoints(res.items || [])
      } else if (tab === 'growth') {
        const res = await adminFinanceApi.listSellerGrowth({ limit: 50 })
        setSellerGrowth(res.items || [])
      } else if (tab === 'reviews_product') {
        const res = await adminFinanceApi.listProductReviews({ limit: 50 })
        setProductReviews(res.items || [])
      } else if (tab === 'reviews_shop') {
        const res = await adminFinanceApi.listShopReviews({ limit: 50 })
        setShopReviews(res.items || [])
      } else if (tab === 'cases') {
        const res = await adminFinanceApi.listCases({ limit: 50 })
        setCases(res.items || [])
      } else if (tab === 'risk') {
        const res = await adminFinanceApi.listRiskEvents({ limit: 50 })
        setRiskEvents(res.items || [])
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load data from backend')
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustPoints = async () => {
    if (!selectedBuyer || !adjustReason) return
    try {
      await adminFinanceApi.adjustBuyerPoints(selectedBuyer.buyer_id, adjustType, adjustAmount, adjustReason)
      setActionSuccess(`Successfully updated points balance for ${selectedBuyer.buyer_name}`)
      setSelectedBuyer(null)
      setAdjustReason('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || 'Adjustment failed')
    }
  }

  const handleModerateProductReview = async (id: string, action: 'hide' | 'restore') => {
    if (action === 'hide' && !moderationReason) {
      alert('Mandatory justification reason required to hide review')
      return
    }
    try {
      if (action === 'hide') {
        await adminFinanceApi.hideProductReview(id, moderationReason)
      } else {
        await adminFinanceApi.restoreProductReview(id, moderationReason || 'Admin restoration')
      }
      setActionSuccess(`Review ${action === 'hide' ? 'hidden' : 'restored'} successfully`)
      setModeratingReviewId(null)
      setModerationReason('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || 'Action failed')
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
      setActionSuccess('Case created successfully')
      setShowCreateCaseModal(false)
      setNewCaseTitle('')
      setNewCaseDesc('')
      loadTabContent()
    } catch (err: any) {
      alert(err?.message || 'Failed to create case')
    }
  }

  return (
    <div style={{ color: '#f8fafc' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>💰</span> Dashboard 3 — Finance / Support / Trust
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Operational control over payments, double-confirmations, points ledgers, seller trust, review moderation, and dispute triage.
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
          { id: 'overview', label: '📊 Financial Summary' },
          { id: 'payments', label: '💵 Cash Payments' },
          { id: 'points', label: '🪙 Buyer Points Ledger' },
          { id: 'growth', label: '📈 Seller Growth & Trust' },
          { id: 'reviews_product', label: '⭐ Product Reviews' },
          { id: 'reviews_shop', label: '🏪 Shop Reviews' },
          { id: 'cases', label: '⚖️ Cases & Disputes' },
          { id: 'risk', label: '🛡️ Fraud & Risk Indicators' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as ActiveTab)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: tab === t.id ? '#2563eb' : '#0f172a',
              color: tab === t.id ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
          Fetching live backend data...
        </div>
      )}

      {/* TAB 1: FINANCIAL SUMMARY OVERVIEW */}
      {!loading && tab === 'overview' && summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <MetricCard title="Total GMV Value" value={`$${summary.total_order_value.toFixed(2)}`} sub={`${summary.total_orders} Total Orders`} color="#60a5fa" />
            <MetricCard title="Verified Cash" value={`$${summary.verified_cash.toFixed(2)}`} sub={`${summary.verified_payments_count} Reconciled Payments`} color="#34d399" />
            <MetricCard title="Unverified Cash" value={`$${summary.unverified_cash.toFixed(2)}`} sub={`${summary.pending_payments_count} Pending Confirmation`} color="#fbbf24" />
            <MetricCard title="Disputed Amount" value={`$${summary.disputed_cash.toFixed(2)}`} sub={`${summary.disputed_payments_count} Active Disputes`} color="#f87171" />
            <MetricCard title="Points Discount GMV" value={`$${summary.points_discount_value.toFixed(2)}`} sub="Redeemed Points Value" color="#a78bfa" />
            <MetricCard title="Open Support Cases" value={String(summary.open_cases_count)} sub="Active Dispute Tickets" color="#f472b6" />
            <MetricCard title="Flagged Reviews" value={String(summary.flagged_reviews_count)} sub="Requires Moderation" color="#fb923c" />
            <MetricCard title="Risk & Fraud Alerts" value={String(summary.risk_alerts_count)} sub="Rule Anomalies Flagged" color="#ef4444" />
          </div>
        </div>
      )}

      {/* TAB 2: CASH PAYMENTS */}
      {!loading && tab === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Real-Time Cash Payment Reconciliation</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{payments.length} Payments Found</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Order #</th>
                <th style={{ padding: '12px 14px' }}>Buyer</th>
                <th style={{ padding: '12px 14px' }}>Shop / Business</th>
                <th style={{ padding: '12px 14px' }}>Total Amount</th>
                <th style={{ padding: '12px 14px' }}>Buyer Paid</th>
                <th style={{ padding: '12px 14px' }}>Seller Recv</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Action</th>
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
                    <StatusBadge ok={p.buyer_confirmed_paid} label={p.buyer_confirmed_paid ? 'CONFIRMED' : 'WAITING'} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge ok={p.seller_confirmed_received} label={p.seller_confirmed_received ? 'CONFIRMED' : 'WAITING'} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      backgroundColor: p.payment_status === 'VERIFIED' ? '#064e3b' : p.payment_status === 'DISPUTED' ? '#7f1d1d' : '#78350f',
                      color: p.payment_status === 'VERIFIED' ? '#34d399' : p.payment_status === 'DISPUTED' ? '#fca5a5' : '#fcd34d'
                    }}>
                      {p.payment_status}
                    </span>
                    {p.anomaly_flag && <span style={{ marginLeft: 6, fontSize: 12 }} title={p.anomaly_reason}>⚠️ Anomaly</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => setSelectedPayment(p)}
                      style={{ padding: '4px 10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: BUYER POINTS LEDGER */}
      {!loading && tab === 'points' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Buyer Points Accounts & Audited Adjustments</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{buyerPoints.length} Buyer Accounts</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Buyer Name</th>
                <th style={{ padding: '12px 14px' }}>Email</th>
                <th style={{ padding: '12px 14px' }}>Current Level</th>
                <th style={{ padding: '12px 14px' }}>Available Points</th>
                <th style={{ padding: '12px 14px' }}>Reserved Points</th>
                <th style={{ padding: '12px 14px' }}>Lifetime Points</th>
                <th style={{ padding: '12px 14px' }}>Actions</th>
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
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60a5fa' }}>{b.available_points.toLocaleString()} pts</td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{b.reserved_points.toLocaleString()} pts</td>
                  <td style={{ padding: '12px 14px', color: '#a78bfa' }}>{b.lifetime_points.toLocaleString()} pts</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => setSelectedBuyer(b)}
                      style={{ padding: '4px 10px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Adjust Points
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: SELLER GROWTH */}
      {!loading && tab === 'growth' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Seller Performance, Growth Levels & Trust Signals</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Seller / Business</th>
                <th style={{ padding: '12px 14px' }}>Level</th>
                <th style={{ padding: '12px 14px' }}>Completed GMV</th>
                <th style={{ padding: '12px 14px' }}>Rating</th>
                <th style={{ padding: '12px 14px' }}>Cash Rate</th>
                <th style={{ padding: '12px 14px' }}>Trust Status</th>
              </tr>
            </thead>
            <tbody>
              {sellerGrowth.map((s) => (
                <tr key={s.seller_id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{s.seller_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{s.business_name} ({s.shop_count} shops)</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 700 }}>{s.level}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#34d399' }}>${s.total_gmv.toFixed(2)}</td>
                  <td style={{ padding: '12px 14px' }}>⭐ {s.average_rating.toFixed(1)} ({s.review_count})</td>
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
        </div>
      )}

      {/* TAB 5: PRODUCT REVIEWS MODERATION */}
      {!loading && tab === 'reviews_product' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Product Review Moderation Queue</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Product</th>
                <th style={{ padding: '12px 14px' }}>Buyer</th>
                <th style={{ padding: '12px 14px' }}>Rating</th>
                <th style={{ padding: '12px 14px' }}>Comment</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Actions</th>
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
                      <button onClick={() => handleModerateProductReview(r.review_id, 'restore')} style={{ padding: '4px 10px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        Restore
                      </button>
                    ) : (
                      <button onClick={() => setModeratingReviewId(r.review_id)} style={{ padding: '4px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        Hide
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: SHOP REVIEWS */}
      {!loading && tab === 'reviews_shop' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Shop & Service Rating Moderation</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Shop</th>
                <th style={{ padding: '12px 14px' }}>Buyer</th>
                <th style={{ padding: '12px 14px' }}>Rating</th>
                <th style={{ padding: '12px 14px' }}>Comment</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 7: CASES & DISPUTES */}
      {!loading && tab === 'cases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dispute Triage & Customer Support Cases</h3>
            <button onClick={() => setShowCreateCaseModal(true)} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              + Open New Case
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Case #</th>
                <th style={{ padding: '12px 14px' }}>Type</th>
                <th style={{ padding: '12px 14px' }}>Title</th>
                <th style={{ padding: '12px 14px' }}>Priority</th>
                <th style={{ padding: '12px 14px' }}>Assigned Admin</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{c.case_number}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#94a3b8' }}>{c.case_type}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{c.title}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: c.priority === 'HIGH' || c.priority === 'URGENT' ? '#7f1d1d' : '#1e293b', color: c.priority === 'HIGH' || c.priority === 'URGENT' ? '#fca5a5' : '#94a3b8' }}>
                      {c.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>{c.assigned_admin || 'Unassigned'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: c.status === 'RESOLVED' ? '#064e3b' : '#78350f', color: c.status === 'RESOLVED' ? '#34d399' : '#fcd34d' }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 8: FRAUD & RISK */}
      {!loading && tab === 'risk' && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Rule-Based Fraud & Anomaly Indicators</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Event Type</th>
                <th style={{ padding: '12px 14px' }}>Severity</th>
                <th style={{ padding: '12px 14px' }}>Target Name</th>
                <th style={{ padding: '12px 14px' }}>Rule Code</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CASH PAYMENT INSPECTION MODAL */}
      {selectedPayment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💵 Cash Payment Detail: {selectedPayment.order_number}</h3>
              <button onClick={() => setSelectedPayment(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Buyer:</span>
                <span style={{ fontWeight: 700 }}>{selectedPayment.buyer_name} ({selectedPayment.buyer_email})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Merchant:</span>
                <span style={{ fontWeight: 700 }}>{selectedPayment.shop_name} ({selectedPayment.business_name})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Subtotal:</span>
                <span>${selectedPayment.subtotal_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Points Discount:</span>
                <span style={{ color: '#a78bfa' }}>-${selectedPayment.points_discount_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Delivery Fee:</span>
                <span>+${selectedPayment.delivery_fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid #334155', paddingTop: 8, marginTop: 6, color: '#34d399' }}>
                <span>Physical Cash Due:</span>
                <span>${selectedPayment.cash_due.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#fbbf24' }}>Double Confirmation State</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>Buyer "I Have Paid":</span>
                <StatusBadge ok={selectedPayment.buyer_confirmed_paid} label={selectedPayment.buyer_confirmed_paid ? `CONFIRMED (${selectedPayment.buyer_confirmed_at ? new Date(selectedPayment.buyer_confirmed_at).toLocaleTimeString() : ''})` : 'WAITING'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                <span>Seller "Confirm Cash Received":</span>
                <StatusBadge ok={selectedPayment.seller_confirmed_received} label={selectedPayment.seller_confirmed_received ? `CONFIRMED (${selectedPayment.seller_confirmed_at ? new Date(selectedPayment.seller_confirmed_at).toLocaleTimeString() : ''})` : 'WAITING'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 8 }}>
                <span>Authoritative Payment Status:</span>
                <span style={{ fontWeight: 700, color: selectedPayment.payment_status === 'VERIFIED' ? '#34d399' : '#fcd34d' }}>{selectedPayment.payment_status}</span>
              </div>
            </div>

            {selectedPayment.anomaly_flag && (
              <div style={{ backgroundColor: '#78350f', border: '1px solid #d97706', color: '#fef3c7', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                ⚠️ Anomaly Detected: {selectedPayment.anomaly_reason}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setNewCaseTitle(`Dispute for Order ${selectedPayment.order_number}`)
                  setNewCaseDesc(`Cash payment dispute for Order ${selectedPayment.order_number}. Buyer confirmed: ${selectedPayment.buyer_confirmed_paid}, Seller confirmed: ${selectedPayment.seller_confirmed_received}. Amount: $${selectedPayment.cash_due.toFixed(2)}`)
                  setNewCaseType('PAYMENT_DISPUTE')
                  setSelectedPayment(null)
                  setShowCreateCaseModal(true)
                }}
                style={{ padding: '8px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                ⚖️ Open Dispute Case
              </button>
              <button onClick={() => setSelectedPayment(null)} style={{ padding: '8px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST POINTS MODAL */}
      {selectedBuyer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Adjust Points: {selectedBuyer.buyer_name}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>Current Available: {selectedBuyer.available_points} pts</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Adjustment Action</label>
              <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="ADD">➕ Add Points</option>
                <option value="REMOVE">➖ Deduct Points</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Amount</label>
              <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Mandatory Justification (min 5 chars)</label>
              <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder="Explain administrative reason for point adjustment..." />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedBuyer(null)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdjustPoints} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Confirm & Audit</button>
            </div>
          </div>
        </div>
      )}

      {/* HIDE REVIEW MODAL */}
      {moderatingReviewId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#ef4444' }}>Hide Review</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>Provide mandatory administrative justification to hide this review from public marketplace.</p>
            
            <textarea value={moderationReason} onChange={(e) => setModerationReason(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6, marginBottom: 20 }} placeholder="Policy violation reason (e.g. abusive language, spam)..." />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModeratingReviewId(null)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleModerateProductReview(moderatingReviewId, 'hide')} style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Hide Review</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CASE MODAL */}
      {showCreateCaseModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 450 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Open New Support & Dispute Case</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Case Type</label>
              <select value={newCaseType} onChange={(e) => setNewCaseType(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="PAYMENT_DISPUTE">PAYMENT_DISPUTE</option>
                <option value="ORDER_CLAIM">ORDER_CLAIM</option>
                <option value="PRODUCT_REPORT">PRODUCT_REPORT</option>
                <option value="REVIEW_REPORT">REVIEW_REPORT</option>
                <option value="SUPPORT_REQUEST">SUPPORT_REQUEST</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Priority</label>
              <select value={newCasePriority} onChange={(e) => setNewCasePriority(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Title</label>
              <input type="text" value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder="Summary title..." />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Description</label>
              <textarea value={newCaseDesc} onChange={(e) => setNewCaseDesc(e.target.value)} rows={3} style={{ width: '100%', padding: 8, backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: 6 }} placeholder="Detailed case description..." />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateCaseModal(false)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreateCase} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Create Case</button>
            </div>
          </div>
        </div>
      )}
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
