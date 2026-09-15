import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { sellerFinanceApi, type SellerFinanceDashboard, type SaleHistoryItem, type SellerFinanceBreakdownItem, type SaleFinanceDetail } from '@/api/seller'

const th = (align: 'left' | 'right' | 'center'): CSSProperties => ({
  textAlign: align, padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600, whiteSpace: 'nowrap'
})

const money = (value: number, currency = 'USD') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)

export default function SellerFinancesPage() {
  const [summary, setSummary] = useState<SellerFinanceDashboard | null>(null)
  const [sales, setSales] = useState<SaleHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [breakdownGroup, setBreakdownGroup] = useState<'shop' | 'product'>('shop')
  const [breakdownItems, setBreakdownItems] = useState<SellerFinanceBreakdownItem[]>([])
  const [selectedSale, setSelectedSale] = useState<SaleFinanceDetail | null>(null)
  const [error, setError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const aggregateMoney = (field: 'gross_sales' | 'commission_amount' | 'seller_net_amount' | 'due_commission' | 'collected_commission') => {
    if (!summary) return ''
    if (summary.totals_by_currency?.length) return summary.totals_by_currency.map((t) => money(t[field], t.currency)).join(' · ')
    return money(summary[field], summary.currency || 'USD')
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [sumRes, salesRes] = await Promise.all([
        sellerFinanceApi.getDashboard({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
        sellerFinanceApi.listSales({
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 50
        })
      ])
      setSummary(sumRes)
      setSales(salesRes.sales || [])
      setTotal(salesRes.total || 0)
    } catch (err) {
      console.error('Failed to load seller finance data', err)
      setSummary(null)
      setSales([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    void fetchData()
    const timer = window.setInterval(() => { void fetchData() }, 30_000)
    return () => window.clearInterval(timer)
  }, [fetchData])

  const loadBreakdown = useCallback(async () => {
    try {
      const res = await sellerFinanceApi.getBreakdown({
        group: breakdownGroup,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      })
      setBreakdownItems(res.items || [])
    } catch (err) {
      console.error('Failed to load seller finance breakdown', err)
    }
  }, [breakdownGroup, dateFrom, dateTo])

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
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', color: 'var(--color-text, #f8fafc)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💳</span> Mes Finances & Commissions TBK
        </h2>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: 14, margin: 0 }}>
          Suivi financier de vos ventes réalisées, calcul de la commission TBK et décompte de votre revenu net vendeur.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: 18, marginBottom: 20, borderRadius: 10, background: '#450a0a', border: '1px solid #991b1b' }}>
          <strong>Impossible de charger les données financières.</strong>
          <button onClick={() => void fetchData()} style={{ marginLeft: 16, padding: '7px 14px', borderRadius: 7 }}>Réessayer</button>
        </div>
      )}

      {/* KPI Cards */}
      {!error && summary && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Chiffre d'Affaires Brut</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text, #f8fafc)', marginTop: 4 }}>
            {aggregateMoney('gross_sales')}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission TBK Totale</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {aggregateMoney('commission_amount')}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Revenu Net Vendeur</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
            {aggregateMoney('seller_net_amount')}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission à Reverser</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#eab308', marginTop: 4 }}>
            {aggregateMoney('due_commission')}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission Déjà Réglée</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {aggregateMoney('collected_commission')}
          </div>
        </div>
      </div>}

      {/* Filters & Search */}
      <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid var(--color-border, #334155)', padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: '', label: 'Toutes les ventes' },
            { id: 'DUE', label: 'À reverser' },
            { id: 'COLLECTED', label: 'Déjà réglées' }
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
                backgroundColor: statusFilter === tab.id ? 'var(--color-primary, #6366f1)' : 'var(--color-surface-2, #0f172a)',
                color: statusFilter === tab.id ? '#ffffff' : 'var(--color-text-muted, #94a3b8)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Rechercher par N° commande..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border, #334155)',
            backgroundColor: 'var(--color-surface-2, #0f172a)',
            color: 'var(--color-text, #f8fafc)',
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
            border: '1px solid var(--color-border, #334155)',
            backgroundColor: 'var(--color-surface-2, #0f172a)',
            color: 'var(--color-text, #f8fafc)',
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
            border: '1px solid var(--color-border, #334155)',
            backgroundColor: 'var(--color-surface-2, #0f172a)',
            color: 'var(--color-text, #f8fafc)',
            fontSize: 13
          }}
        />
        <div style={{ fontSize: 13, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>
          {total} vente(s) trouvée(s)
        </div>
      </div>

      {/* Breakdown by shop / product (per date range) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted, #94a3b8)' }}>Répartition par :</span>
          {(['shop', 'product'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setBreakdownGroup(g)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: breakdownGroup === g ? 'var(--color-primary, #6366f1)' : 'var(--color-surface-2, #0f172a)',
                color: breakdownGroup === g ? '#ffffff' : 'var(--color-text-muted, #94a3b8)',
              }}
            >
              {g === 'shop' ? 'Boutique' : 'Produit'}
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid var(--color-border, #334155)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #334155)', backgroundColor: 'var(--color-surface-2, #0f172a)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>{breakdownGroup === 'shop' ? 'Boutique' : 'Produit'}</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Ventes</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Vente Brute</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Net Vendeur</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)' }}>Aucune vente dans cette répartition.</td></tr>
              ) : breakdownItems.map((item) => (
                <tr key={`${item.id || item.label}`} style={{ borderBottom: '1px solid var(--color-border-soft, #1e293b)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{item.label}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>{item.sales_count}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>{money(item.gross_sales, item.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#818cf8' }}>{money(item.commission_amount, item.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#4ade80' }}>{money(item.seller_net_amount, item.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales List Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)' }}>
          Chargement de votre journal financier...
        </div>
      ) : sales.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)', backgroundColor: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid var(--color-border, #334155)' }}>
          Aucune vente enregistrée pour le moment.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid var(--color-border, #334155)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #334155)', backgroundColor: 'var(--color-surface-2, #0f172a)' }}>
                <th style={th('left')}>Date / Commande</th>
                <th style={th('left')}>Acheteur</th>
                <th style={th('left')}>Entreprise / Boutique</th>
                <th style={th('left')}>Produits / Variantes</th>
                <th style={th('center')}>Qté</th>
                <th style={th('right')}>Vente Brute</th>
                <th style={th('center')}>Taux TBK</th>
                <th style={th('right')}>Commission TBK</th>
                <th style={th('right')}>Net Vendeur</th>
                <th style={th('left')}>Paiement</th>
                <th style={th('center')}>Livraison</th>
                <th style={th('center')}>Statut Commission</th>
                <th style={th('right')}>Détail</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-soft, #1e293b)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800 }}>#{item.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)' }}>
                      {new Date(item.calculated_at).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{item.buyer_name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{item.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)' }}>{item.business_name}</div>
                  </td>
                  <td style={{ padding: '12px 16px', minWidth: 220 }}>
                    {(item.lines || []).length === 0 ? '—' : (item.lines || []).map((line, i) => (
                      <div key={`${item.id}-line-${i}`}>
                        <span style={{ fontWeight: 600 }}>{line.product_name || '—'}</span>
                        {line.variant_name ? <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}> · {line.variant_name}</span> : null}
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)' }}>
                          {' '}({line.quantity} × {money(line.final_unit_price, item.currency)})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700 }}>{item.total_quantity || 0}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>
                    {money(item.gross_amount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary, #6366f1)' }}>
                    {item.commission_rate.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#818cf8' }}>
                    {money(item.commission_amount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#4ade80' }}>
                    {money(item.seller_net_amount, item.currency)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{item.payment_method || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)' }}>{item.payment_status || '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontSize: 12 }}>
                    {item.delivery_status || item.delivery_method || item.order_status || '—'}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 6,
                      backgroundColor: item.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: item.status === 'COLLECTED' ? '#4ade80' : '#eab308'
                    }}>
                      {item.status === 'COLLECTED' ? 'Réglée' : 'À reverser'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                    <button
                      onClick={() => void openSale(item.order_id)}
                      disabled={detailLoading}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border, #334155)',
                        backgroundColor: 'var(--color-surface-2, #0f172a)',
                        color: 'var(--color-text, #f8fafc)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🔍 Résumé
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
            backgroundColor: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: 12, padding: 24, maxWidth: 460, width: '100%',
            color: 'var(--color-text, #f8fafc)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vente #{selectedSale.sale.order_number}</span>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </h3>

            <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
              <div><strong>Acheteur :</strong> {selectedSale.buyer_name || '—'}</div>
              <div><strong>Entreprise / boutique :</strong> {selectedSale.sale.business_name} / {selectedSale.sale.shop_name}</div>
              <div><strong>Paiement :</strong> {selectedSale.payment_method || '—'} · {selectedSale.payment_status || '—'}</div>
              <div><strong>Commande / livraison :</strong> {selectedSale.order_status} · {selectedSale.delivery_status || selectedSale.delivery_method || '—'}</div>
              <div><strong>Date :</strong> {new Date(selectedSale.ordered_at).toLocaleString()}</div>
            </div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Produit / variante</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
                <tbody>{selectedSale.lines.map((line, index) => <tr key={`${line.product_id}-${line.variant_id}-${index}`}>
                  <td>{line.product_name}<br/><small>{line.variant_name || line.variant_sku || '—'}</small></td>
                  <td style={{ textAlign: 'center' }}>{line.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{money(line.final_unit_price, selectedSale.sale.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{money(line.gross_amount, selectedSale.sale.currency)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface-2, #0f172a)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Montant Produits Vente</span>
                <span style={{ fontWeight: 700 }}>{money(selectedSale.sale.gross_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Base calcul commission</span>
                <span style={{ fontWeight: 700 }}>{money(selectedSale.sale.commission_base, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Majoration paiement</span><span>{money(selectedSale.payment_markup, selectedSale.sale.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Frais de livraison</span><span>{money(selectedSale.delivery_fee, selectedSale.sale.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Taux de commission TBK</span>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>{selectedSale.sale.commission_rate.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: 8 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Commission TBK</span>
                <span style={{ fontWeight: 800, color: '#818cf8' }}>- {money(selectedSale.sale.commission_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: '#4ade80' }}>Revenu Net Vendeur</span>
                <span style={{ fontWeight: 900, color: '#4ade80', fontSize: 15 }}>{money(selectedSale.sale.seller_net_amount, selectedSale.sale.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: '#94a3b8' }}>Statut Règlement</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  backgroundColor: selectedSale.sale.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: selectedSale.sale.status === 'COLLECTED' ? '#4ade80' : '#eab308'
                }}>
                  {selectedSale.sale.status === 'COLLECTED' ? 'Réglée à TBK' : 'À reverser à TBK'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSale(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--color-primary, #6366f1)', color: '#ffffff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
