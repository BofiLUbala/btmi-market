import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAdminOrderCommunications, type ConversationListItem } from '@/api/communication'
import { useOrderEvents } from '@/lib/orderEvents'
import { ErrorBox } from '@/components/ui/Feedback'
import { ConversationInbox } from '@/components/communication/ConversationInbox'

const STATUSES: [string, string][] = [
  ['', 'Tous les statuts'], ['PENDING', 'En attente'], ['ACCEPTED', 'Acceptée'], ['PREPARING', 'En préparation'],
  ['READY', 'Prête'], ['OUT_FOR_DELIVERY', 'En livraison'], ['DELIVERED', 'Livrée'], ['COMPLETED', 'Terminée'], ['CANCELLED', 'Annulée'],
]

/**
 * TBK support inbox: the private channels the buyer, the seller team and the
 * courier each have with TBK on an order. Admins see these channels only,
 * never buyer <-> courier or seller <-> courier threads.
 */
export default function CommerceOrderCommunicationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrderId = searchParams.get('order_id') || ''

  const [items, setItems] = useState<ConversationListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  // The server searches every order, not only the rows loaded here.
  const [query, setQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])
  const [status, setStatus] = useState('')
  const [onlyWithMessages, setOnlyWithMessages] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchAdminOrderCommunications({ search: query || undefined, status: status || undefined, with_messages: onlyWithMessages, limit: 100, offset: 0 })
      setItems(res?.items || [])
      setTotal(res?.total || 0)
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [query, status, onlyWithMessages])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 30_000)
    return () => clearInterval(timer)
  }, [load])
  useOrderEvents(() => void load(true), { audience: 'admin' })

  const select = useCallback((orderId: string) => setSearchParams({ order_id: orderId }), [setSearchParams])
  const back = useCallback(() => setSearchParams({}), [setSearchParams])

  return (
    <div style={{ paddingBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--admin-text, #f8fafc)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        💬 Messages des commandes
        <span style={{ fontSize: 13, background: 'var(--admin-surface-2, #1e293b)', padding: '2px 10px', borderRadius: 12, color: 'var(--admin-text-muted, #94a3b8)' }}>{total}</span>
      </h2>
      <div style={{ color: 'var(--admin-text-muted, #94a3b8)', fontSize: 13, marginBottom: 12 }}>
        Canaux privés avec le support TBK : acheteur, boutique et livreur écrivent chacun à TBK, jamais entre acheteur et boutique.
      </div>
      {error && <ErrorBox error={error} onRetry={() => void load()} />}
      <ConversationInbox
        me="ADMIN"
        items={items}
        loading={loading}
        selectedOrderId={selectedOrderId}
        onSelect={select}
        onBack={back}
        search={search}
        onSearch={setSearch}
        onlyWithMessages={onlyWithMessages}
        onOnlyWithMessages={setOnlyWithMessages}
        subtitle={(c) => [c.shop_name, c.buyer_name].filter(Boolean).join(' · ')}
        tools={(
          <select className="inbox-search" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut de commande">
            {STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        )}
        chatActions={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button type="button" className="chat-send" style={{ height: 34, fontSize: 13 }} onClick={() => navigate(`/admin/commerce/orders/${selectedOrderId}`)}>
              Fiche commande →
            </button>
          </div>
        )}
      />
    </div>
  )
}
