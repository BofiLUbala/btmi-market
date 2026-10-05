import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { formatMoney, formatDateTime } from '@/lib/format'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { sellerFinanceApi, type SellerFinanceDashboard, type SaleHistoryItem, type SellerFinanceBreakdownItem, type SaleFinanceDetail, type SellerFinanceTimeseriesPoint, type SellerBreakdownGroup } from '@/api/seller'
import FinanceTrendChart from '@/components/ui/FinanceTrendChart'
import { SearchIcon } from '@/components/ui/Icons'

const th = (align: 'left' | 'right' | 'center'): CSSProperties => ({
  textAlign: align, padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap'
})

const money = (value: number, currency = 'USD') => formatMoney(value, currency)

/** The dimensions a seller may slice their own sales by. `seller` is absent on
 *  purpose: within a seller's own scope every row would be the same person. */
const GROUP_TABS: Array<{ id: SellerBreakdownGroup; labelKey: TranslationKey }> = [
  { id: 'shop', labelKey: 'sellerFinancesSellerFinancesPage.groupShop' as TranslationKey },
  { id: 'product', labelKey: 'sellerFinancesSellerFinancesPage.groupProduct' as TranslationKey },
  { id: 'variant', labelKey: 'sellerFinancesSellerFinancesPage.groupVariant' as TranslationKey },
  { id: 'business', labelKey: 'sellerFinancesSellerFinancesPage.groupBusiness' as TranslationKey }
]

export default function SellerFinancesPage() {
  const { t } = useI18n()
  /** Translated API code (`prefix` + code), falling back to the code itself. */
  const code = (prefix: string, value?: string | null) => {
    if (!value) return '—'
    const key = `${prefix}${value}`
    const label = t(key as TranslationKey)
    return label === key ? value : label
  }
  const [summary, setSummary] = useState<SellerFinanceDashboard | null>(null)
  const [sales, setSales] = useState<SaleHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [breakdownGroup, setBreakdownGroup] = useState<SellerBreakdownGroup>('shop')
  const [breakdownItems, setBreakdownItems] = useState<SellerFinanceBreakdownItem[]>([])
  const [trend, setTrend] = useState<SellerFinanceTimeseriesPoint[]>([])
  const [selectedSale, setSelectedSale] = useState<SaleFinanceDetail | null>(null)
  const [error, setError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const aggregateMoney = (field: 'gross_sales' | 'commission_amount' | 'seller_net_amount' | 'due_commission' | 'collected_commission' | 'payments_collected' | 'payments_due') => {
    if (!summary) return ''
    if (summary.totals_by_currency?.length) return summary.totals_by_currency.map((t) => money(t[field], t.currency)).join(' · ')
    return money(summary[field], summary.currency || 'USD')
  }

  // Every request below carries the same filter, so the KPI cards, the chart
  // and the sales table are always three views of one server-side population.
  const scope = useMemo(() => ({
    payment_status: paymentStatusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined
  }), [paymentStatusFilter, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [sumRes, salesRes, trendRes] = await Promise.all([
        sellerFinanceApi.getDashboard(scope),
        sellerFinanceApi.listSales({
          ...scope,
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          limit: 50
        }),
        sellerFinanceApi.getTimeseries({ ...scope, interval: 'day' })
      ])
      setSummary(sumRes)
      setSales(salesRes.sales || [])
      setTotal(salesRes.total || 0)
      setTrend(trendRes.points || [])
    } catch (err) {
      console.error('Failed to load seller finance data', err)
      setSummary(null)
      setSales([])
      setTrend([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, scope])

  useEffect(() => {
    void fetchData()
    const timer = window.setInterval(() => { void fetchData() }, 30_000)
    return () => window.clearInterval(timer)
  }, [fetchData])

  const loadBreakdown = useCallback(async () => {
    try {
      const res = await sellerFinanceApi.getBreakdown({ ...scope, group: breakdownGroup })
      setBreakdownItems(res.items || [])
    } catch (err) {
      console.error('Failed to load seller finance breakdown', err)
      setBreakdownItems([])
      setError(true)
    }
  }, [breakdownGroup, scope])

  useEffect(() => {
    void loadBreakdown()
  }, [loadBreakdown])

  const openSale = async (orderId: string) => {
    setDetailLoading(true)
    try { setSelectedSale(await sellerFinanceApi.getSaleDetail(orderId)) }
    catch { setError(true) }
    finally { setDetailLoading(false) }
  }

  return (
    <div className="seller-finances-page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('sellerFinancesSellerFinancesPage.title')}</h1>
          <p>
            {t('sellerFinancesSellerFinancesPage.subtitle')}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="error-box" style={{ marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{t('sellerFinancesSellerFinancesPage.loadError')}</strong>
          <button className="btn btn-outline btn-sm" onClick={() => void fetchData()} style={{ marginLeft: 16 }}>{t('common.retry')}</button>
        </div>
      )}

      {/* KPI Cards */}
      {!error && summary && <div className="seller-metrics-grid finance-kpis" style={{ marginBottom: 24 }}>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiGross')}</div>
          <div className="stat-value">{aggregateMoney('gross_sales')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiCommission')}</div>
          <div className="stat-value stat-value--info">{aggregateMoney('commission_amount')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.sellerNetRevenue')}</div>
          <div className="stat-value stat-value--success">{aggregateMoney('seller_net_amount')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiDue')}</div>
          <div className="stat-value stat-value--warning">{aggregateMoney('due_commission')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiCollected')}</div>
          <div className="stat-value stat-value--info">{aggregateMoney('collected_commission')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiPaymentsCollected')}</div>
          <div className="stat-value stat-value--success">{aggregateMoney('payments_collected')}</div>
          <div className="small muted">{t('sellerFinancesSellerFinancesPage.kpiPaymentsCollectedHint')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiPaymentsDue')}</div>
          <div className="stat-value stat-value--warning">{aggregateMoney('payments_due')}</div>
          <div className="small muted">{t('sellerFinancesSellerFinancesPage.kpiPaymentsDueHint')}</div>
        </div>
        <div className="seller-stat-card">
          <div className="stat-label">{t('sellerFinancesSellerFinancesPage.kpiUnits')}</div>
          <div className="stat-value">{summary.units_sold}</div>
          <div className="small muted">{t('sellerFinancesSellerFinancesPage.verifiedSales', { count: summary.verified_sales })}</div>
        </div>
      </div>}

      {/* Évolution réelle — série renvoyée par le backend, jamais de démo. */}
      {!error && summary && (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t('sellerFinancesSellerFinancesPage.trendTitle')}</div>
          <FinanceTrendChart points={trend} />
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: '', label: t('sellerFinancesSellerFinancesPage.filterAll') },
            { id: 'DUE', label: t('sellerFinancesSellerFinancesPage.filterDue') },
            { id: 'COLLECTED', label: t('sellerFinancesSellerFinancesPage.filterCollected') }
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
                backgroundColor: statusFilter === tab.id ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: statusFilter === tab.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder={t('sellerFinancesSellerFinancesPage.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            fontSize: 13
          }}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            fontSize: 13
          }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            fontSize: 13
          }}
        />
        {/* Statut de paiement: axe acheteur, filtré côté serveur, indépendant
            du statut de commission sélectionné plus haut. */}
        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
          aria-label={t('sellerFinancesSellerFinancesPage.paymentStatus')}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)'
          }}
        >
          <option value="">{t('sellerFinancesSellerFinancesPage.payAll')}</option>
          <option value="VERIFIED">{t('sellerFinancesSellerFinancesPage.payVerified')}</option>
          <option value="PAID">{t('sellerFinancesSellerFinancesPage.payPaid')}</option>
          <option value="PENDING">{t('sellerFinancesSellerFinancesPage.payPending')}</option>
          <option value="CONFIRMED">{t('sellerFinancesSellerFinancesPage.payConfirmed')}</option>
          <option value="REFUNDED">{t('sellerFinancesSellerFinancesPage.payRefunded')}</option>
        </select>

        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {t('sellerFinancesSellerFinancesPage.salesFound', { count: total })}
        </div>
      </div>

      {/* Breakdown by shop / product (per date range) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.breakdownBy')}</span>
          {GROUP_TABS.map((g) => (
            <button
              key={g.id}
              onClick={() => setBreakdownGroup(g.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: breakdownGroup === g.id ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: breakdownGroup === g.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
              }}
            >
              {t(g.labelKey)}
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <th style={th('left')}>{t(GROUP_TABS.find((g) => g.id === breakdownGroup)?.labelKey ?? GROUP_TABS[0].labelKey)}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colOrders')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colUnits')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colGross')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colCommission')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colNet')}</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.breakdownEmpty')}</td></tr>
              ) : breakdownItems.map((item) => (
                <tr key={`${item.id || item.label}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    {item.label}
                    {item.sub_label && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{item.sub_label}</div>}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>{item.sales_count}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>{item.units_sold}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>{money(item.gross_sales, item.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: 'var(--color-info)' }}>{money(item.commission_amount, item.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: 'var(--color-success)' }}>{money(item.seller_net_amount, item.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales List Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          {t('sellerFinancesSellerFinancesPage.loadingJournal')}
        </div>
      ) : sales.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          {t('sellerFinancesSellerFinancesPage.salesEmpty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <th style={th('left')}>{t('sellerFinancesSellerFinancesPage.colDateOrder')}</th>
                <th style={th('left')}>{t('sellerFinancesSellerFinancesPage.colBuyer')}</th>
                <th style={th('left')}>{t('sellerFinancesSellerFinancesPage.colBusinessShop')}</th>
                <th style={th('left')}>{t('sellerFinancesSellerFinancesPage.colProducts')}</th>
                <th style={th('center')}>{t('sellerFinancesSellerFinancesPage.colQty')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colGross')}</th>
                <th style={th('center')}>{t('sellerFinancesSellerFinancesPage.colRate')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colCommission')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colNet')}</th>
                <th style={th('left')}>{t('sellerFinancesSellerFinancesPage.colPayment')}</th>
                <th style={th('center')}>{t('sellerFinancesSellerFinancesPage.colDelivery')}</th>
                <th style={th('center')}>{t('sellerFinancesSellerFinancesPage.colCommissionStatus')}</th>
                <th style={th('right')}>{t('sellerFinancesSellerFinancesPage.colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800 }}>#{item.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {formatDateTime(item.calculated_at)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{item.buyer_name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{item.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.business_name}</div>
                  </td>
                  <td style={{ padding: '12px 16px', minWidth: 220 }}>
                    {(item.lines || []).length === 0 ? '—' : (item.lines || []).map((line, i) => (
                      <div key={`${item.id}-line-${i}`}>
                        <span style={{ fontWeight: 600 }}>{line.product_name || '—'}</span>
                        {line.variant_name ? <span style={{ color: 'var(--color-text-muted)' }}> · {line.variant_name}</span> : null}
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {' '}({line.quantity} × {money(line.final_unit_price, item.currency)})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700 }}>{item.total_quantity || 0}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>
                    {money(item.gross_amount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {item.commission_rate.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: 'var(--color-info)' }}>
                    {money(item.commission_amount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: 'var(--color-success)' }}>
                    {money(item.seller_net_amount, item.currency)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{code('payment.method.', item.payment_method)}</div>
                    {/* The operator, so a mobile sale can be reconciled against
                        that operator's own statement. */}
                    {item.provider && (
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{item.provider.replace(/_/g, ' ')}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{code('tracking.pay.', item.payment_status)}</div>
                    {item.payment_reference && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{item.payment_reference}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontSize: 12 }}>
                    {code('status.', item.delivery_status || item.delivery_method || item.order_status)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 6,
                      backgroundColor: item.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: item.status === 'COLLECTED' ? 'var(--color-success)' : 'var(--color-warning)'
                    }}>
                      {item.status === 'COLLECTED' ? t('sellerFinancesSellerFinancesPage.statusCollected') : t('sellerFinancesSellerFinancesPage.filterDue')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                    <button
                      onClick={() => void openSale(item.order_id)}
                      disabled={detailLoading}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface-2)',
                        color: 'var(--color-text)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <SearchIcon className="inline-icon" /> {t('sellerFinancesSellerFinancesPage.summary')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12, padding: 24, maxWidth: 460, width: '100%',
            color: 'var(--color-text)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('sellerFinancesSellerFinancesPage.saleNumber', { number: selectedSale.sale.order_number })}</span>
              <button onClick={() => setSelectedSale(null)} aria-label={t('common.close')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </h3>

            <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
              <div><strong>{t('sellerFinancesSellerFinancesPage.detailBuyer')}</strong> {selectedSale.buyer_name || '—'}</div>
              <div><strong>{t('sellerFinancesSellerFinancesPage.detailBusinessShop')}</strong> {selectedSale.sale.business_name} / {selectedSale.sale.shop_name}</div>
              <div>
                <strong>{t('sellerFinancesSellerFinancesPage.detailPayment')}</strong> {code('payment.method.', selectedSale.payment_method)}
                {selectedSale.provider ? ` · ${selectedSale.provider.replace(/_/g, ' ')}` : ''} · {code('tracking.pay.', selectedSale.payment_status)}
                {selectedSale.payment_reference ? ` · ${t('sellerFinancesSellerFinancesPage.refShort', { ref: selectedSale.payment_reference })}` : ''}
              </div>
              <div><strong>{t('sellerFinancesSellerFinancesPage.detailOrderDelivery')}</strong> {code('status.', selectedSale.order_status)} · {code('status.', selectedSale.delivery_status || selectedSale.delivery_method)}</div>
              <div><strong>{t('sellerFinancesSellerFinancesPage.detailDate')}</strong> {formatDateTime(selectedSale.ordered_at)}</div>
            </div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>{t('sellerFinancesSellerFinancesPage.colProductVariant')}</th><th>{t('sellerFinancesSellerFinancesPage.colQty')}</th><th>{t('sellerFinancesSellerFinancesPage.colUnitPrice')}</th><th>{t('common.total')}</th></tr></thead>
                <tbody>{selectedSale.lines.map((line, index) => <tr key={`${line.product_id}-${line.variant_id}-${index}`}>
                  <td>{line.product_name}<br/><small>{line.variant_name || line.variant_sku || '—'}</small></td>
                  <td style={{ textAlign: 'center' }}>{line.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{money(line.final_unit_price, selectedSale.sale.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{money(line.gross_amount, selectedSale.sale.currency)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface-2)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailProductsAmount')}</span>
                <span style={{ fontWeight: 700 }}>{money(selectedSale.sale.gross_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailCommissionBase')}</span>
                <span style={{ fontWeight: 700 }}>{money(selectedSale.sale.commission_base, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailPaymentMarkup')}</span><span>{money(selectedSale.payment_markup, selectedSale.sale.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailDeliveryFee')}</span><span>{money(selectedSale.delivery_fee, selectedSale.sale.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailRate')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-info)' }}>{selectedSale.sale.commission_rate.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('sellerFinancesSellerFinancesPage.colCommission')}</span>
                <span style={{ fontWeight: 800, color: 'var(--color-info)' }}>- {money(selectedSale.sale.commission_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: 'var(--color-success)' }}>{t('sellerFinancesSellerFinancesPage.sellerNetRevenue')}</span>
                <span style={{ fontWeight: 900, color: 'var(--color-success)', fontSize: 15 }}>{money(selectedSale.sale.seller_net_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('sellerFinancesSellerFinancesPage.detailSettlementStatus')}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  backgroundColor: selectedSale.sale.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: selectedSale.sale.status === 'COLLECTED' ? 'var(--color-success)' : 'var(--color-warning)'
                }}>
                  {selectedSale.sale.status === 'COLLECTED' ? t('sellerFinancesSellerFinancesPage.settledToTbk') : t('sellerFinancesSellerFinancesPage.dueToTbk')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSale(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
