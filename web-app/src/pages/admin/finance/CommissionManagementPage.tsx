import { useState, useEffect, useCallback } from 'react'
import { adminLabel } from '@/lib/adminLabels'
import { dateLocale, formatMoney, formatDateTime } from '@/lib/format'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { adminFinanceApi, type AdminCommissionConfig, type AdminCommissionItem, type AdminSaleHistoryItem, type AdminCommissionSummary, type FinanceBreakdownItem, type FinanceBreakdownGroup } from '@/api/admin'

// Amounts are shown in the currency of the sale itself. Never relabel a
// historical CDF sale as USD (or XAF) just because the reader changed.
const money = (value: number, currency?: string) =>
  formatMoney(value || 0, currency || 'USD')

type SummaryCurrencyField = 'gross_sales' | 'commission_amount' | 'seller_net_amount' | 'due_commission' | 'collected_commission' | 'payments_collected' | 'payments_due'

const COMMISSION_STATUS_BADGE: Record<string, { labelKey: TranslationKey; bg: string; fg: string }> = {
  DUE: { labelKey: 'adminFinanceCommissionManagementPage.badgeDue', bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
  COLLECTED: { labelKey: 'adminFinanceCommissionManagementPage.badgeCollected', bg: 'rgba(34, 197, 94, 0.15)', fg: '#4ade80' },
  WAIVED: { labelKey: 'adminFinanceCommissionManagementPage.badgeWaived', bg: 'rgba(148, 163, 184, 0.15)', fg: '#94a3b8' },
  ADJUSTED: { labelKey: 'adminFinanceCommissionManagementPage.badgeAdjusted', bg: 'rgba(129, 140, 248, 0.15)', fg: '#818cf8' }
}

/** Rows fetched per page of the sales journal (the API caps a page at 100). */
const JOURNAL_PAGE = 100

const BREAKDOWN_LABELS: Record<FinanceBreakdownGroup, TranslationKey> = {
  shop: 'adminFinanceCommissionManagementPage.groupShop',
  product: 'adminFinanceCommissionManagementPage.groupProduct',
  variant: 'adminFinanceCommissionManagementPage.groupVariant',
  seller: 'adminFinanceCommissionManagementPage.groupSeller',
  business: 'adminFinanceCommissionManagementPage.groupBusiness'
}

const GROUP_LABEL: Record<FinanceBreakdownGroup, TranslationKey> = { shop: 'adminFinanceCommissionManagementPage.byShop', product: 'adminFinanceCommissionManagementPage.byProduct', variant: 'adminFinanceCommissionManagementPage.byVariant', seller: 'adminFinanceCommissionManagementPage.bySeller', business: 'adminFinanceCommissionManagementPage.byBusiness' }

export default function CommissionManagementPage() {
  const t = useT()

  const [config, setConfig] = useState<AdminCommissionConfig | null>(null)
  const [summary, setSummary] = useState<AdminCommissionSummary | null>(null)
  const [commissions, setCommissions] = useState<AdminSaleHistoryItem[]>([])
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Breakdown state (TBK finance report per entity)
  const [breakdownGroup, setBreakdownGroup] = useState<FinanceBreakdownGroup>('shop')
  const [breakdownItems, setBreakdownItems] = useState<FinanceBreakdownItem[]>([])
  // The buyer's payment status is a separate axis from the commission status
  // filtered below; both are applied by the backend.
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')

  // Edit Rate Modal state
  const [editRateModal, setEditRateModal] = useState(false)
  const [newRate, setNewRate] = useState<number>(0)
  const [changeReason, setChangeReason] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  // Mark Collected Modal state
  const [collectModalItem, setCollectModalItem] = useState<AdminCommissionItem | null>(null)
  const [collectNotes, setCollectNotes] = useState('')
  const [savingCollection, setSavingCollection] = useState(false)

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [error, setError] = useState(false)

  // Totals are rendered per currency so a CDF sale and a USD sale are never
  // summed into one meaningless number.
  const aggregateMoney = (field: SummaryCurrencyField, flat: number) => {
    if (!summary) return ''
    if (summary.totals_by_currency?.length) {
      return summary.totals_by_currency.map((t) => money(t[field], t.currency)).join(' · ')
    }
    return money(flat, summary.currency)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const scope = {
        payment_status: paymentStatusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }
      const [configRes, summaryRes, commsRes] = await Promise.all([
        adminFinanceApi.getCommissionConfig(),
        adminFinanceApi.getCommissionSummary({
          ...scope,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        adminFinanceApi.listCommissions({
          ...scope,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchQuery || undefined,
          limit: JOURNAL_PAGE
        })
      ])
      setConfig(configRes)
      setSummary(summaryRes)
      setCommissions(commsRes.commissions || [])
      setTotal(commsRes.total || 0)
    } catch (err) {
      // Never fall back to a fabricated 0: an unreachable finance API is an
      // error the admin must see, not a platform with no revenue.
      console.error('Failed to load commission data', err)
      setSummary(null)
      setCommissions([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paymentStatusFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // The journal is paged by the API; beyond the first page the admin loads
  // more instead of silently never seeing the older sales.
  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await adminFinanceApi.listCommissions({
        payment_status: paymentStatusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery || undefined,
        limit: JOURNAL_PAGE,
        offset: commissions.length
      })
      setCommissions((rows) => [...rows, ...(res.commissions || [])])
      setTotal(res.total || 0)
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('adminFinanceCommissionManagementPage.loadFailed') })
    } finally {
      setLoadingMore(false)
    }
  }

  const loadBreakdown = useCallback(async () => {
    try {
      const res = await adminFinanceApi.getFinanceBreakdown({
        group: breakdownGroup,
        payment_status: paymentStatusFilter || undefined,
        commission_status: statusFilter !== 'ALL' ? statusFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      })
      setBreakdownItems(res.items || [])
    } catch (err) {
      // A breakdown that cannot load must not leave stale rows on screen
      // claiming to describe the current filter.
      console.error('Failed to load finance breakdown', err)
      setBreakdownItems([])
      setError(true)
    }
  }, [breakdownGroup, statusFilter, paymentStatusFilter, dateFrom, dateTo])

  useEffect(() => {
    void loadBreakdown()
  }, [loadBreakdown])

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newRate < 0 || newRate > 100) return
    setSavingRate(true)
    setMsg(null)
    try {
      const updated = await adminFinanceApi.updateCommissionConfig({
        rate: newRate,
        reason: changeReason || 'Mise à jour par l\'administrateur Finance'
      })
      setConfig(updated)
      setMsg({ type: 'success', text: t('adminFinanceCommissionManagementPage.rateUpdated', { rate: newRate }) })
      setEditRateModal(false)
      setChangeReason('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('adminFinanceCommissionManagementPage.rateUpdateFailed') })
    } finally {
      setSavingRate(false)
    }
  }

  const handleMarkCollected = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectModalItem) return
    setSavingCollection(true)
    setMsg(null)
    try {
      await adminFinanceApi.markCommissionCollected(collectModalItem.id, collectNotes)
      setMsg({ type: 'success', text: t('adminFinanceCommissionManagementPage.markedCollected', { order: collectModalItem.order_number }) })
      setCollectModalItem(null)
      setCollectNotes('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('adminFinanceCommissionManagementPage.collectFailed') })
    } finally {
      setSavingCollection(false)
    }
  }

  return (
    <div style={{ color: 'var(--admin-text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💰</span> {t('adminFinanceCommissionManagementPage.title')}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('adminFinanceCommissionManagementPage.subtitle')}
          </p>
        </div>
      </div>

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

      {/* Main Config Card */}
      <div style={{
        backgroundColor: 'var(--admin-surface)',
        border: '1px solid var(--admin-border-soft)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--admin-text-muted)', letterSpacing: 0.5 }}>
            {t('adminFinanceCommissionManagementPage.rateCardTitle')}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--admin-primary)', margin: '4px 0' }}>
            {config ? config.rate.toFixed(2) : '—'} %
          </div>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
            {t('adminFinanceCommissionManagementPage.rateCardHint')}
          </div>
        </div>

        <button
          onClick={() => {
            setNewRate(config?.rate ?? 0)
            setEditRateModal(true)
          }}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'var(--admin-primary)',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          ✏️ {t('adminFinanceCommissionManagementPage.editRate')}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: 18, marginBottom: 20, borderRadius: 10, background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca' }}>
          <strong>{t('adminFinanceCommissionManagementPage.loadError')}</strong>
          <button onClick={() => void fetchData()} style={{ marginLeft: 16, padding: '7px 14px', borderRadius: 7, cursor: 'pointer' }}>{t('common.retry')}</button>
        </div>
      )}

      {/* KPI Cards */}
      {!error && summary && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiGross')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--admin-text)', marginTop: 4 }}>
            {aggregateMoney('gross_sales', summary?.gross_sales || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiCommission')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {aggregateMoney('commission_amount', summary?.total_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiDue')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#eab308', marginTop: 4 }}>
            {aggregateMoney('due_commission', summary?.due_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiCollected')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
            {aggregateMoney('collected_commission', summary?.collected_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiSellerNet')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {aggregateMoney('seller_net_amount', summary?.seller_net_revenue || 0)}
          </div>
        </div>

        {/* Axe acheteur. Un acheteur peut avoir tout regle alors que la
            commission TBK ci-dessus reste due: les deux ne se confondent pas. */}
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiPaymentsCollected')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#facc15', marginTop: 4 }}>
            {aggregateMoney('payments_collected', summary?.payments_collected || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiPaymentsDue')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fb923c', marginTop: 4 }}>
            {aggregateMoney('payments_due', summary?.payments_due || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.kpiUnits')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--admin-text)', marginTop: 4 }}>
            {summary?.units_sold ?? 0}
          </div>
        </div>
      </div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['shop', 'product', 'variant', 'seller', 'business'] as const).map((g) => (
          <button
            key={g}
            onClick={() => {
              setBreakdownGroup(g)
              void loadBreakdown()
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid var(--admin-border)',
              cursor: 'pointer',
              backgroundColor: breakdownGroup === g ? 'var(--admin-primary)' : 'var(--admin-surface-2)',
              color: breakdownGroup === g ? '#ffffff' : 'var(--admin-text-muted)',
            }}
          >
            {t(GROUP_LABEL[g])}
          </button>
        ))}
      </div>

      {loading ? null : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t(BREAKDOWN_LABELS[breakdownGroup])}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thOrders')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thUnits')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thGross')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thCommission')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thSellerNet')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thCollectedDue')}</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>{t('adminFinanceCommissionManagementPage.breakdownEmpty')}</td></tr>
              ) : breakdownItems.map((item) => (
                <tr key={`${item.id || item.label}`} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                    {item.label}
                    {item.sub_label && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--admin-text-muted)' }}>{item.sub_label}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{item.sales_count}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{item.units_sold}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{money(item.gross_sales, item.currency)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#818cf8' }}>{money(item.commission_amount, item.currency)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>{money(item.seller_net_amount, item.currency)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--admin-text-muted)' }}>{money(item.collected, item.currency)} / {money(item.due, item.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: t('adminFinanceCommissionManagementPage.tabAll') },
            { id: 'DUE', label: t('adminFinanceCommissionManagementPage.tabDue') },
            { id: 'COLLECTED', label: t('adminFinanceCommissionManagementPage.tabCollected') },
            { id: 'WAIVED', label: t('adminFinanceCommissionManagementPage.tabWaived') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === tab.id ? 'var(--admin-primary)' : 'var(--admin-surface-2)',
                color: statusFilter === tab.id ? '#ffffff' : 'var(--admin-text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}

          {/* Statut de paiement acheteur - axe distinct du statut de
              commission ci-dessus, filtre lui aussi cote serveur. */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            aria-label={t('adminFinanceCommissionManagementPage.paymentStatus')}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)'
            }}
          >
            <option value="">{t('adminFinanceCommissionManagementPage.paymentAll')}</option>
            <option value="VERIFIED">{t('adminFinanceCommissionManagementPage.paymentVerified')}</option>
            <option value="PAID">{t('adminFinanceCommissionManagementPage.paymentPaid')}</option>
            <option value="PENDING">{t('adminFinanceCommissionManagementPage.paymentPending')}</option>
            <option value="CONFIRMED">{t('adminFinanceCommissionManagementPage.paymentConfirmed')}</option>
            <option value="REFUNDED">{t('adminFinanceCommissionManagementPage.paymentRefunded')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder={t('adminFinanceCommissionManagementPage.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              flex: 1,
              minWidth: 220,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              fontSize: 13
            }}
          />
          <input
            type="date"
            value={dateFrom}
            aria-label={t('adminFinanceCommissionManagementPage.dateFrom')}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              fontSize: 13
            }}
          />
          <input
            type="date"
            value={dateTo}
            aria-label={t('adminFinanceCommissionManagementPage.dateTo')}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              fontSize: 13
            }}
          />
        </div>
      </div>

      {/* Commission Sales Table */}
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--admin-text-muted)', fontWeight: 600 }}>
        {t('adminFinanceCommissionManagementPage.countRecorded', { count: total })}
      </div>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          {t('adminFinanceCommissionManagementPage.journalLoading')}
        </div>
      ) : commissions.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('adminFinanceCommissionManagementPage.journalEmpty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thOrder')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thShopSeller')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thBuyer')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thProducts')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thQty')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thGross')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thBase')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thRate')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thCommission')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thSellerNet')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thPayment')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('adminFinanceCommissionManagementPage.thDelivery')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('common.status')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--admin-text)' }}>#{c.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                      {new Date(c.calculated_at).toLocaleString(dateLocale())}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{c.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{c.business_name}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{c.buyer_name || '—'}</td>
                  <td style={{ padding: '12px 14px', minWidth: 220 }}>
                    {(c.lines || []).length === 0 ? '—' : (c.lines || []).map((line, i) => (
                      <div key={`${c.id}-line-${i}`}>
                        <span style={{ fontWeight: 600 }}>{line.product_name || '—'}</span>
                        {line.variant_name ? <span style={{ color: 'var(--admin-text-muted)' }}> · {line.variant_name}</span> : null}
                        <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                          {' '}({line.quantity} × {money(line.final_unit_price, c.currency)})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 700 }}>{c.total_quantity || 0}</td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700 }}>
                    {money(c.gross_amount, c.currency)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)' }}>
                    {money(c.commission_base, c.currency)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                    {c.commission_rate.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: '#818cf8' }}>
                    {money(c.commission_amount, c.currency)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: '#38bdf8' }}>
                    {money(c.seller_net_amount, c.currency)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{adminLabel(c.payment_method || '—')}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{adminLabel(c.payment_status || '—')}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12 }}>
                    {adminLabel(c.delivery_status || c.delivery_method || c.order_status)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      backgroundColor: (COMMISSION_STATUS_BADGE[c.status] ?? COMMISSION_STATUS_BADGE.DUE).bg,
                      color: (COMMISSION_STATUS_BADGE[c.status] ?? COMMISSION_STATUS_BADGE.DUE).fg
                    }}>
                      {COMMISSION_STATUS_BADGE[c.status] ? t(COMMISSION_STATUS_BADGE[c.status].labelKey) : c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    {c.status === 'DUE' ? (
                      <button
                        onClick={() => {
                          setCollectModalItem(c)
                          setCollectNotes('')
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: 'var(--admin-primary)',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        💳 {t('adminFinanceCommissionManagementPage.markCollected')}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {c.status === 'WAIVED'
                          ? t('adminFinanceCommissionManagementPage.saleCancelled')
                          : c.collected_at
                            ? (c.collector_name
                              ? t('adminFinanceCommissionManagementPage.settledOnBy', { date: formatDateTime(c.collected_at), name: c.collector_name })
                              : t('adminFinanceCommissionManagementPage.settledOn', { date: formatDateTime(c.collected_at) }))
                            : (c.collector_name
                              ? t('adminFinanceCommissionManagementPage.collectedBy', { name: c.collector_name })
                              : t('adminFinanceCommissionManagementPage.collected'))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length < total && (
            <div style={{ padding: 12, textAlign: 'center' }}>
              <button onClick={() => void loadMore()} disabled={loadingMore}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {loadingMore ? t('common.loading') : t('adminFinanceCommissionManagementPage.showMore', { shown: commissions.length, total })}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rate history: who changed the platform rate, when and why. */}
      {config?.history && config.history.length > 0 && (
        <div style={{ marginTop: 20, backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14, overflowX: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('adminFinanceCommissionManagementPage.historyTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}>
                <th style={{ padding: '6px 8px' }}>{t('common.date')}</th>
                <th style={{ padding: '6px 8px' }}>{t('adminFinanceCommissionManagementPage.thOldNew')}</th>
                <th style={{ padding: '6px 8px' }}>{t('adminFinanceCommissionManagementPage.thBy')}</th>
                <th style={{ padding: '6px 8px' }}>{t('adminFinanceCommissionManagementPage.thReason')}</th>
              </tr>
            </thead>
            <tbody>
              {config.history.slice(0, 10).map((h) => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '6px 8px' }}>{new Date(h.created_at).toLocaleString(dateLocale())}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{h.old_rate.toFixed(2)} % → {h.new_rate.toFixed(2)} %</td>
                  <td style={{ padding: '6px 8px' }}>{h.admin_name || '—'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--admin-text-muted)' }}>{h.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editRateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            borderRadius: 12, padding: 24, maxWidth: 440, width: '100%',
            color: 'var(--admin-text)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>
              {t('adminFinanceCommissionManagementPage.editModalTitle')}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              {t('adminFinanceCommissionManagementPage.editModalHint')}
            </p>

            <form onSubmit={handleUpdateRate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  {t('adminFinanceCommissionManagementPage.newRateLabel')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={newRate}
                  onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)', fontSize: 16, fontWeight: 800,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  {t('adminFinanceCommissionManagementPage.reasonLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('adminFinanceCommissionManagementPage.reasonPlaceholder')}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)', fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={savingRate}
                  onClick={() => setEditRateModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingRate}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    backgroundColor: 'var(--admin-primary)', color: '#ffffff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {savingRate ? t('adminFinanceCommissionManagementPage.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Commission Modal */}
      {collectModalItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            borderRadius: 12, padding: 24, maxWidth: 440, width: '100%',
            color: 'var(--admin-text)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>
              {t('adminFinanceCommissionManagementPage.collectModalTitle')}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              {t('adminFinanceCommissionManagementPage.orderLabel')} <strong>#{collectModalItem.order_number}</strong> • {t('adminFinanceCommissionManagementPage.commissionAmountLabel')} <strong style={{ color: '#818cf8' }}>{money(collectModalItem.commission_amount, collectModalItem.currency)}</strong>
            </p>

            <form onSubmit={handleMarkCollected}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  {t('adminFinanceCommissionManagementPage.collectNoteLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('adminFinanceCommissionManagementPage.collectNotePlaceholder')}
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)', fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={savingCollection}
                  onClick={() => setCollectModalItem(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingCollection}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    backgroundColor: '#22c55e', color: '#ffffff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {savingCollection ? t('adminFinanceCommissionManagementPage.validating') : t('adminFinanceCommissionManagementPage.confirmCollect')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
