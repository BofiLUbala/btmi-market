import { useState, useEffect, useCallback } from 'react'
import { sellerFinanceApi, type SellerFinanceSummary, type SellerSaleCommissionItem } from '@/api/seller'

export default function SellerFinancesPage() {
  const [summary, setSummary] = useState<SellerFinanceSummary | null>(null)
  const [sales, setSales] = useState<SellerSaleCommissionItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSale, setSelectedSale] = useState<SellerSaleCommissionItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, salesRes] = await Promise.all([
        sellerFinanceApi.getSummary(),
        sellerFinanceApi.listSales({
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          limit: 50
        })
      ])
      setSummary(sumRes)
      setSales(salesRes.sales || [])
      setTotal(salesRes.total || 0)
    } catch (err) {
      console.error('Failed to load seller finance data', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Chiffre d'Affaires Brut</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text, #f8fafc)', marginTop: 4 }}>
            {(summary?.gross_sales || 0).toLocaleString()} XAF
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission TBK Totale</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {(summary?.tbk_commission_total || 0).toLocaleString()} XAF
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Revenu Net Vendeur</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
            {(summary?.seller_net_revenue || 0).toLocaleString()} XAF
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission à Reverser</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#eab308', marginTop: 4 }}>
            {(summary?.commission_due || 0).toLocaleString()} XAF
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission Déjà Réglée</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {(summary?.commission_collected || 0).toLocaleString()} XAF
          </div>
        </div>
      </div>

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
        <div style={{ fontSize: 13, color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>
          {total} vente(s) trouvée(s)
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
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commande</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Boutique</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Vente Brute</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Taux TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Commission TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Net Vendeur</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Statut Commission</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600 }}>Détail</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-soft, #1e293b)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800 }}>#{item.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)' }}>
                      {new Date(item.calculated_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{item.shop_name}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>
                    {(item.gross_amount || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary, #6366f1)' }}>
                    {item.commission_rate.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#818cf8' }}>
                    {(item.commission_amount || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#4ade80' }}>
                    {(item.seller_net_amount || 0).toLocaleString()} XAF
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
                      onClick={() => setSelectedSale(item)}
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
              <span>Résumé Financier Vente #{selectedSale.order_number}</span>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </h3>

            <div style={{ backgroundColor: 'var(--color-surface-2, #0f172a)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Montant Produits Vente</span>
                <span style={{ fontWeight: 700 }}>{(selectedSale.gross_amount || 0).toLocaleString()} XAF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Base calcul commission</span>
                <span style={{ fontWeight: 700 }}>{(selectedSale.commission_base || 0).toLocaleString()} XAF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Taux de commission TBK</span>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>{selectedSale.commission_rate.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: 8 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Commission TBK</span>
                <span style={{ fontWeight: 800, color: '#818cf8' }}>- {(selectedSale.commission_amount || 0).toLocaleString()} XAF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: '#4ade80' }}>Revenu Net Vendeur</span>
                <span style={{ fontWeight: 900, color: '#4ade80', fontSize: 15 }}>{(selectedSale.seller_net_amount || 0).toLocaleString()} XAF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: '#94a3b8' }}>Statut Règlement</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  backgroundColor: selectedSale.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: selectedSale.status === 'COLLECTED' ? '#4ade80' : '#eab308'
                }}>
                  {selectedSale.status === 'COLLECTED' ? 'Réglée à TBK' : 'À reverser à TBK'}
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
