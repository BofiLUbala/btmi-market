import { useState, useEffect, useCallback } from 'react'
import { formatMoney } from '@/lib/format'
import { adminFinanceApi, type AdminCommissionConfig, type AdminCommissionItem, type AdminSaleHistoryItem, type AdminCommissionSummary, type FinanceBreakdownItem, type FinanceBreakdownGroup } from '@/api/admin'

// Amounts are shown in the currency of the sale itself. Never relabel a
// historical CDF sale as USD (or XAF) just because the reader changed.
const money = (value: number, currency?: string) =>
  formatMoney(value || 0, currency || 'USD')

type SummaryCurrencyField = 'gross_sales' | 'commission_amount' | 'seller_net_amount' | 'due_commission' | 'collected_commission' | 'payments_collected' | 'payments_due'

const COMMISSION_STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  DUE: { label: 'À reverser', bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
  COLLECTED: { label: 'Réglée', bg: 'rgba(34, 197, 94, 0.15)', fg: '#4ade80' },
  WAIVED: { label: 'Annulée', bg: 'rgba(148, 163, 184, 0.15)', fg: '#94a3b8' },
  ADJUSTED: { label: 'Ajustée', bg: 'rgba(129, 140, 248, 0.15)', fg: '#818cf8' }
}

/** Rows fetched per page of the sales journal (the API caps a page at 100). */
const JOURNAL_PAGE = 100

const BREAKDOWN_LABELS: Record<FinanceBreakdownGroup, string> = {
  shop: 'Boutique',
  product: 'Produit',
  variant: 'Variante',
  seller: 'Vendeur',
  business: 'Entreprise'
}

export default function CommissionManagementPage() {

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
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Chargement impossible' })
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
            {config ? config.rate.toFixed(2) : '—'} %
          </div>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
            Taux actuel applicable automatiquement à toutes les nouvelles ventes vérifiées.
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
          ✏️ Modifier le Taux
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: 18, marginBottom: 20, borderRadius: 10, background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca' }}>
          <strong>Impossible de charger les données financières.</strong>
          <button onClick={() => void fetchData()} style={{ marginLeft: 16, padding: '7px 14px', borderRadius: 7, cursor: 'pointer' }}>Réessayer</button>
        </div>
      )}

      {/* KPI Cards */}
      {!error && summary && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Chiffre d'Affaires Brut</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--admin-text)', marginTop: 4 }}>
            {aggregateMoney('gross_sales', summary?.gross_sales || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission TBK Générée</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {aggregateMoney('commission_amount', summary?.total_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission À Reverser (DUE)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#eab308', marginTop: 4 }}>
            {aggregateMoney('due_commission', summary?.due_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission Réglée</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
            {aggregateMoney('collected_commission', summary?.collected_commission || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Revenu Net Vendeurs</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {aggregateMoney('seller_net_amount', summary?.seller_net_revenue || 0)}
          </div>
        </div>

        {/* Axe acheteur. Un acheteur peut avoir tout regle alors que la
            commission TBK ci-dessus reste due: les deux ne se confondent pas. */}
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Paiements Encaisses</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#facc15', marginTop: 4 }}>
            {aggregateMoney('payments_collected', summary?.payments_collected || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Paiements Dus</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fb923c', marginTop: 4 }}>
            {aggregateMoney('payments_due', summary?.payments_due || 0)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Unites Vendues</div>
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
            Répartition par {g}
          </button>
        ))}
      </div>

      {loading ? null : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{BREAKDOWN_LABELS[breakdownGroup]}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commandes</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Unités</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Vente Brute</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Net Vendeur</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Réglée / Due</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>Aucune commission dans cette répartition.</td></tr>
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
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'ALL', label: 'Toutes les ventes' },
            { id: 'DUE', label: '⏳ À reverser (DUE)' },
            { id: 'COLLECTED', label: '✅ Réglées (COLLECTED)' },
            { id: 'WAIVED', label: '↩️ Annulées (WAIVED)' }
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
            aria-label="Statut de paiement"
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)'
            }}
          >
            <option value="">Paiement - tous</option>
            <option value="VERIFIED">Paiement verifie</option>
            <option value="PAID">Paye</option>
            <option value="PENDING">En attente</option>
            <option value="CONFIRMED">Confirme</option>
            <option value="REFUNDED">Rembourse</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Rechercher par N° commande, Entreprise ou Boutique..."
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
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Acheteur</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Produits / Variantes</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Qté</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Vente Brute</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Base Commission</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Taux TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commission TBK</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Net Vendeur</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Paiement</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Livraison</th>
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
                    <div style={{ fontWeight: 600 }}>{c.payment_method || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{c.payment_status || '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12 }}>
                    {c.delivery_status || c.delivery_method || c.order_status || '—'}
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
                      {COMMISSION_STATUS_BADGE[c.status]?.label ?? c.status}
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
                        {c.status === 'WAIVED'
                          ? 'Vente annulée'
                          : `${c.collected_at ? `Réglée le ${new Date(c.collected_at).toLocaleDateString()}` : 'Encaissée'}${c.collector_name ? ` par ${c.collector_name}` : ''}`}
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
                {loadingMore ? 'Chargement…' : `Afficher plus (${commissions.length} / ${total})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rate history: who changed the platform rate, when and why. */}
      {config?.history && config.history.length > 0 && (
        <div style={{ marginTop: 20, backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Historique du taux de commission</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}>
                <th style={{ padding: '6px 8px' }}>Date</th>
                <th style={{ padding: '6px 8px' }}>Ancien → nouveau</th>
                <th style={{ padding: '6px 8px' }}>Par</th>
                <th style={{ padding: '6px 8px' }}>Motif</th>
              </tr>
            </thead>
            <tbody>
              {config.history.slice(0, 10).map((h) => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '6px 8px' }}>{new Date(h.created_at).toLocaleString()}</td>
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
              Commande <strong>#{collectModalItem.order_number}</strong> • Montant Commission: <strong style={{ color: '#818cf8' }}>{money(collectModalItem.commission_amount, collectModalItem.currency)}</strong>
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
