import { useState, useEffect, useCallback } from 'react'
import { adminFinanceApi, type AdminCommissionConfig, type AdminCommissionItem, type AdminCommissionSummary } from '@/api/admin'

export default function CommissionManagementPage() {

  const [config, setConfig] = useState<AdminCommissionConfig | null>(null)
  const [summary, setSummary] = useState<AdminCommissionSummary | null>(null)
  const [commissions, setCommissions] = useState<AdminCommissionItem[]>([])
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Edit Rate Modal state
  const [editRateModal, setEditRateModal] = useState(false)
  const [newRate, setNewRate] = useState<number>(3.0)
  const [changeReason, setChangeReason] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  // Mark Collected Modal state
  const [collectModalItem, setCollectModalItem] = useState<AdminCommissionItem | null>(null)
  const [collectNotes, setCollectNotes] = useState('')
  const [savingCollection, setSavingCollection] = useState(false)

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, summaryRes, commsRes] = await Promise.all([
        adminFinanceApi.getCommissionConfig(),
        adminFinanceApi.getCommissionSummary({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
        adminFinanceApi.listCommissions({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchQuery || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 100
        })
      ])
      setConfig(configRes)
      setSummary(summaryRes)
      setCommissions(commsRes.commissions || [])
      setTotal(commsRes.total || 0)
    } catch (err) {
      console.error('Failed to load commission data', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

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
      setMsg({ type: 'success', text: `Taux de commission TBK mis à jour avec succès: ${newRate}%` })
      setEditRateModal(false)
      setChangeReason('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Échec de la modification du taux' })
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
      setMsg({ type: 'success', text: `Commission de la commande #${collectModalItem.order_number} marquée comme réglée.` })
      setCollectModalItem(null)
      setCollectNotes('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Échec de l\'encaissement' })
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
            <span>💰</span> Commission sur les Ventes TBK
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            Configuration du taux de commission plateforme, suivi des revenus nets vendeurs et gestion du recouvrement.
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
            COMMISSION SUR LES VENTES TBK
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--admin-primary)', margin: '4px 0' }}>
            {config ? config.rate.toFixed(2) : '3.00'} %
          </div>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
            Taux actuel applicable automatiquement à toutes les nouvelles ventes vérifiées.
          </div>
        </div>

        <button
          onClick={() => {
            setNewRate(config?.rate || 3.0)
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
          ✏️ Modifier le Taux
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Chiffre d'Affaires Brut</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--admin-text)', marginTop: 4 }}>
            {(summary?.gross_sales || 0).toLocaleString()} XAF
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission TBK Générée</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {(summary?.total_commission || 0).toLocaleString()} XAF
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission À Reverser (DUE)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#eab308', marginTop: 4 }}>
            {(summary?.due_commission || 0).toLocaleString()} XAF
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission Réglée</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
            {(summary?.collected_commission || 0).toLocaleString()} XAF
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Revenu Net Vendeurs</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {(summary?.seller_net_revenue || 0).toLocaleString()} XAF
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'ALL', label: 'Toutes les ventes' },
            { id: 'DUE', label: '⏳ À reverser (DUE)' },
            { id: 'COLLECTED', label: '✅ Réglées (COLLECTED)' }
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
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Rechercher par N° commande, Entreprise ou Boutique..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
        {total} commission(s) enregistrée(s)
      </div>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          Chargement du journal des commissions...
        </div>
      ) : commissions.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          Aucune commission enregistrée selon les filtres sélectionnés.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commande</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Boutique / Vendeur</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Vente Brute</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Base Commission</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Taux TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Net Vendeur</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Statut</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--admin-text)' }}>#{c.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                      {new Date(c.calculated_at).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{c.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{c.business_name}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700 }}>
                    {(c.gross_amount || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)' }}>
                    {(c.commission_base || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                    {c.commission_rate.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: '#818cf8' }}>
                    {(c.commission_amount || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: '#38bdf8' }}>
                    {(c.seller_net_amount || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      backgroundColor: c.status === 'COLLECTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: c.status === 'COLLECTED' ? '#4ade80' : '#eab308'
                    }}>
                      {c.status === 'COLLECTED' ? 'Réglée' : 'À reverser'}
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
                        💳 Marquer Réglée
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {c.collected_at ? `Réglée le ${new Date(c.collected_at).toLocaleDateString()}` : 'Encaissée'}
                      </span>
                    )}
                  </td>
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
              Modifier le Taux de Commission sur les Ventes
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              Ce nouveau taux s'appliquera automatiquement aux nouvelles ventes vérifiées. Les ventes antérieures conservent leur snapshot historique.
            </p>

            <form onSubmit={handleUpdateRate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Nouveau Taux de Commission (%) *
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
                  Motif du changement de taux
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ajustement annuel, offre de lancement..."
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
                  Annuler
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
                  {savingRate ? 'Enregistrement...' : 'Enregistrer'}
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
              Confirmer l'Encaissement de la Commission
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              Commande <strong>#{collectModalItem.order_number}</strong> • Montant Commission: <strong style={{ color: '#818cf8' }}>{(collectModalItem.commission_amount || 0).toLocaleString()} XAF</strong>
            </p>

            <form onSubmit={handleMarkCollected}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Note de règlement / Référence de paiement
                </label>
                <input
                  type="text"
                  placeholder="Ex: Reçu espèces N°884, virement bancaire..."
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
                  Annuler
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
                  {savingCollection ? 'Validation...' : 'Confirmer le Règlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
