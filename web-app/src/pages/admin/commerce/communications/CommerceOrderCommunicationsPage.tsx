import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  fetchAdminOrderCommunications,
  type ConversationListItem,
} from '@/api/communication'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badges'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { OrderChatFeed } from '@/components/communication/OrderChatFeed'

export default function CommerceOrderCommunicationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrderId = searchParams.get('order_id') || ''

  const [items, setItems] = useState<ConversationListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchAdminOrderCommunications({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          limit: 50,
          offset: 0,
        })
        setItems(res.items || [])
        setTotal(res.total || 0)
        setError('')

        // Auto-select first item if none selected
        if (!selectedOrderId && res.items?.length > 0) {
          setSearchParams({ order_id: res.items[0].order_id }, { replace: true })
        }
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'Failed to load conversations')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [search, statusFilter, selectedOrderId, setSearchParams]
  )

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(true), 15_000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div style={{ padding: '0 0 24px', height: 'calc(100vh - 120px)', minHeight: 620, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>💬 Communications Commandes (Supervision)</span>
            <span style={{ fontSize: 13, background: '#1e293b', padding: '2px 10px', borderRadius: 12, color: '#94a3b8' }}>
              {total} canaux
            </span>
          </h2>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Surveillance et intervention officielle TBK Admin dans les échanges Acheteurs ↔ Vendeurs.
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Rechercher commande, boutique, acheteur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f8fafc',
              fontSize: 13,
              width: 260,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f8fafc',
              fontSize: 13,
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">PENDING</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="PREPARING">PREPARING</option>
            <option value="READY">READY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {error && <ErrorBox error={error} />}

      {/* Main Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 380px) 1fr',
          gap: 16,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Channels */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
            Canaux actifs
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <LoadingBlock />
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                Aucune conversation trouvée.
              </div>
            ) : (
              items.map((c) => {
                const isSelected = c.order_id === selectedOrderId
                return (
                  <div
                    key={c.conversation_id}
                    onClick={() => setSearchParams({ order_id: c.order_id })}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: isSelected ? '#1e293b' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#38bdf8' }}>
                        #{c.order_number || c.order_id.slice(0, 8)}
                      </span>
                      <StatusBadge status={c.order_status} />
                    </div>

                    <div style={{ fontSize: 12, color: '#f8fafc', marginBottom: 2, fontWeight: 600 }}>
                      🏪 {c.shop_name || 'Boutique'} ↔ 👤 {c.buyer_name || 'Acheteur'}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}
                    >
                      {c.last_message || 'Pas encore de messages'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                      <span>{c.unread_count} message(s)</span>
                      <span>{formatDateTime(c.last_message_at || c.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Feed */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          {selectedOrderId ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/commerce/orders/${selectedOrderId}`)}
                >
                  📄 Voir la fiche commande complète →
                </Button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <OrderChatFeed
                  key={selectedOrderId}
                  orderId={selectedOrderId}
                  role="ADMIN"
                  showHeader={true}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 10,
                padding: 32,
              }}
            >
              <EmptyState
                icon="💬"
                title="Sélectionnez une commande"
                description="Choisissez un canal de commande dans la liste pour superviser ou intervenir."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
