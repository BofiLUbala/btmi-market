import { useEffect, useState, useCallback } from 'react'
import { adminCommerceApi, type AdminShopListItem, type ShopAnalytics, type ShopProductWithStock, type SalesTimeseriesPoint } from '@/api/admin'
import { useT } from '@/store/i18n'
import { adminLabel } from '@/lib/adminLabels'
import { SalesLineChart, SalesValueChart, AverageOrderValueChart } from '@/components/admin/ShopAnalyticsChart'

const LIMIT = 50

interface ShopWithAnalytics extends AdminShopListItem {
  analytics?: ShopAnalytics
  products?: ShopProductWithStock[]
  sales?: SalesTimeseriesPoint[]
  loadingAnalytics?: boolean
}

export default function CommerceShopsAnalyticsPage() {
  const t = useT()
  const [shops, setShops] = useState<ShopWithAnalytics[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [timeInterval, setTimeInterval] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(0) }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchShops = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminCommerceApi.listShops({ search: search || undefined, limit: LIMIT, offset: page * LIMIT })
      setShops(res.shops ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void fetchShops() }, [fetchShops])

  const loadShopAnalytics = useCallback(async (shopId: string) => {
    const idx = shops.findIndex(s => s.id === shopId)
    if (idx === -1) return

    setShops(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], loadingAnalytics: true }
      return updated
    })

    try {
      const [analytics, productsRes, salesRes] = await Promise.all([
        adminCommerceApi.getShopAnalytics(shopId),
        adminCommerceApi.getShopProductsWithStock(shopId),
        adminCommerceApi.getShopSalesTimeseries(shopId, { interval: timeInterval })
      ])

      setShops(prev => {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          analytics,
          products: productsRes.products,
          sales: salesRes.timeseries,
          loadingAnalytics: false
        }
        return updated
      })
    } catch (err) {
      console.error('Failed to load shop analytics:', err)
      setShops(prev => {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], loadingAnalytics: false }
        return updated
      })
    }
  }, [shops, timeInterval])

  const selectedShop = shops.find(s => s.id === selectedShopId)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div style={{ display: 'flex', gap: 20, height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 400px', borderRight: '1px solid var(--admin-border)', overflow: 'auto', backgroundColor: 'var(--admin-surface)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--admin-border-soft)', sticky: true, top: 0, backgroundColor: 'var(--admin-surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--admin-text)' }}>Boutiques & Produits</h2>
          <input
            aria-label="Rechercher une boutique"
            placeholder="Boutique, ville…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)', boxSizing: 'border-box' }}
          />
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)' }}>Chargement…</div>
        ) : shops.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)' }}>Aucune boutique</div>
        ) : (
          <div>
            {shops.map((shop) => (
              <div
                key={shop.id}
                onClick={() => {
                  setSelectedShopId(shop.id)
                  if (!shop.analytics) void loadShopAnalytics(shop.id)
                }}
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--admin-border-soft)',
                  cursor: 'pointer',
                  backgroundColor: selectedShopId === shop.id ? 'var(--admin-surface-2)' : undefined,
                  borderLeft: selectedShopId === shop.id ? '3px solid #0ea5e9' : '3px solid transparent'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--admin-text)', fontSize: 13, marginBottom: 4 }}>{shop.name}</div>
                <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginBottom: 4 }}>{shop.business_name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--admin-text-muted)' }}>Produits:</span> <strong>{shop.product_count}</strong></div>
                  <div><span style={{ color: 'var(--admin-text-muted)' }}>Stock:</span> <strong>{shop.available_units}</strong></div>
                  <div><span style={{ color: 'var(--admin-text-muted)' }}>Commandes:</span> <strong>{shop.order_count}</strong></div>
                  <div><span style={{ color: 'var(--admin-text-muted)' }}>Note:</span> <strong>★ {shop.review_score.toFixed(1)}</strong></div>
                </div>
              </div>
            ))}
            {totalPages > 1 && (
              <div style={{ padding: 12, display: 'flex', justifyContent: 'center', gap: 8, borderTop: '1px solid var(--admin-border-soft)' }}>
                <button
                  className="admin-button admin-button-small"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >Précédent</button>
                <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{page + 1} / {totalPages}</span>
                <button
                  className="admin-button admin-button-small"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >Suivant</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'var(--admin-danger-soft)', border: '1px solid var(--admin-danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--admin-text)' }}>
            <span>⚠️ {error}</span>
            <button onClick={() => void fetchShops()} className="admin-button" style={{ flexShrink: 0 }}>Réessayer</button>
          </div>
        )}

        {!selectedShop ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            <p>Sélectionnez une boutique pour voir les détails</p>
          </div>
        ) : selectedShop.loadingAnalytics ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            Chargement des données…
          </div>
        ) : !selectedShop.analytics ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            Erreur lors du chargement
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', color: 'var(--admin-text)' }}>{selectedShop.analytics.shop_name}</h1>
              <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>{selectedShop.analytics.business_name} · {selectedShop.city}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KPICard label="Produits actifs" value={selectedShop.analytics.active_products} subtext={`/ ${selectedShop.analytics.total_products}`} />
              <KPICard label="Stock disponible" value={selectedShop.analytics.available_stock} subtext={`/ ${selectedShop.analytics.total_stock}`} />
              <KPICard label="Stock réservé" value={selectedShop.analytics.reserved_stock} highlight={selectedShop.analytics.reserved_stock > 0} />
              <KPICard label="Ventes (total)" value={`${(selectedShop.analytics.total_sales_value / 1000).toFixed(1)}K`} subtext={`${selectedShop.analytics.total_sales_count} commandes`} />
              <KPICard label="Panier moyen" value={`${selectedShop.analytics.avg_order_value.toFixed(0)} FBU`} />
              <KPICard label="Rotation stock" value={selectedShop.analytics.stock_turnover_rate.toFixed(2)} subtext="fois/mois" />
              <KPICard label="Santé boutique" value={`${(selectedShop.analytics.health_score * 100).toFixed(0)}%`} highlight={selectedShop.analytics.health_score >= 0.8} />
            </div>

            <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--admin-text)' }}>Évolution des ventes</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {(['day', 'week', 'month', 'year'] as const).map((interval) => (
                  <button
                    key={interval}
                    onClick={() => {
                      setTimeInterval(interval)
                      void loadShopAnalytics(selectedShop.id)
                    }}
                    className="admin-button admin-button-small"
                    style={{
                      backgroundColor: timeInterval === interval ? '#0ea5e9' : 'var(--admin-surface-2)',
                      color: timeInterval === interval ? 'white' : 'var(--admin-text)',
                      border: timeInterval === interval ? 'none' : '1px solid var(--admin-border)'
                    }}
                  >
                    {interval === 'day' ? 'Jour' : interval === 'week' ? 'Semaine' : interval === 'month' ? 'Mois' : 'Année'}
                  </button>
                ))}
              </div>

              {selectedShop.sales && selectedShop.sales.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  <SalesLineChart data={selectedShop.sales} interval={timeInterval} />
                  <SalesValueChart data={selectedShop.sales} interval={timeInterval} />
                  <AverageOrderValueChart data={selectedShop.sales} interval={timeInterval} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>Pas de données disponibles</div>
              )}
            </div>

            <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--admin-text)' }}>Produits & Stock</h3>
              {selectedShop.products && selectedShop.products.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Produit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Prix</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Stock</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Disponible</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Réservé</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Ventes (J/S/M)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShop.products.map((product) => (
                        <tr key={product.product_id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--admin-text)' }}>
                            <div style={{ fontWeight: 600 }}>{product.product_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{product.sku}</div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text)' }}>{product.unit_price} FBU</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text)' }}>{product.total_stock}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text)' }}>{product.available_stock}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: product.reserved_stock > 0 ? '#f59e0b' : 'var(--admin-text)' }}>{product.reserved_stock}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--admin-text)' }}>
                            <span>{product.sales_today}</span> / <span>{product.sales_this_week}</span> / <span>{product.sales_this_month}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              backgroundColor: product.stock_status === 'IN_STOCK' ? '#dcfce7' : product.stock_status === 'LOW_STOCK' ? '#fef08a' : '#fee2e2',
                              color: product.stock_status === 'IN_STOCK' ? '#166534' : product.stock_status === 'LOW_STOCK' ? '#ca8a04' : '#991b1b'
                            }}>
                              {product.stock_status === 'IN_STOCK' ? 'En stock' : product.stock_status === 'LOW_STOCK' ? 'Stock bas' : 'Rupture'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>Pas de produits</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KPICard({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: boolean }) {
  return (
    <div style={{
      backgroundColor: 'var(--admin-surface-2)',
      border: `1px solid ${highlight ? '#0ea5e9' : 'var(--admin-border)'}`,
      borderRadius: 10,
      padding: '12px 16px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: highlight ? '#0ea5e9' : 'var(--admin-text)', marginBottom: 4 }}>{value}</div>
      {subtext && <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{subtext}</div>}
    </div>
  )
}
