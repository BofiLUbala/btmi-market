import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchSellerConversations,
  type ConversationListItem,
} from '@/api/communication'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/ui/Badges'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { OrderChatFeed } from '@/components/communication/OrderChatFeed'

export default function SellerMessagesPage() {
  const { t } = useI18n()
  const { activeShop, activeBusiness } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrderId = searchParams.get('order_id') || ''

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchSellerConversations({
          shop_id: activeShop || undefined,
          business_id: activeBusiness?.id || undefined,
          limit: 50,
          offset: 0,
        })
        setConversations(res.items || [])
        setError('')

        // Auto-select first if none selected
        if (!selectedOrderId && res.items?.length > 0) {
          setSearchParams({ order_id: res.items[0].order_id }, { replace: true })
        }
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [activeShop, activeBusiness?.id, selectedOrderId, setSearchParams, t]
  )

  useEffect(() => {
    void loadConversations()
    const timer = setInterval(() => void loadConversations(true), 15_000)
    return () => clearInterval(timer)
  }, [loadConversations])

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.order_number.toLowerCase().includes(q) ||
      c.buyer_name.toLowerCase().includes(q) ||
      c.last_message.toLowerCase().includes(q) ||
      c.shop_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="fade-in stack" style={{ height: 'calc(100vh - 120px)', minHeight: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💬 {t('seller.messages')}</span>
          </h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            {t('communication.sellerSubtitle')}
          </p>
        </div>
      </div>

      {error && <ErrorBox error={error} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 360px) 1fr',
          gap: 16,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Conversation List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-surface-1)',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* Search bar */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>
            <input
              type="search"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* List items */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {loading && conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <LoadingBlock />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>💬</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('communication.noConversations')}</div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.order_id === selectedOrderId
                return (
                  <div
                    key={c.conversation_id}
                    onClick={() => setSearchParams({ order_id: c.order_id })}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-surface-3, rgba(230, 81, 0, 0.08))' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                        #{c.order_number || c.order_id.slice(0, 8)}
                      </span>
                      <StatusBadge status={c.order_status} />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: '0.82rem',
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        👤 {c.buyer_name || t('communication.buyer')}
                      </span>
                      <span className="small muted" style={{ fontSize: '0.72rem' }}>
                        {formatDateTime(c.last_message_at || c.created_at)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: c.unread_count > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                        fontWeight: c.unread_count > 0 ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.last_message || t('communication.noMessagesYet')}
                    </div>

                    {c.unread_count > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 12,
                          bottom: 12,
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: 10,
                          padding: '1px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Feed */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          {selectedOrderId ? (
            <OrderChatFeed
              key={selectedOrderId}
              orderId={selectedOrderId}
              role="SELLER"
              showHeader={true}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface-1)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                padding: 32,
                textAlign: 'center',
              }}
            >
              <EmptyState
                icon="💬"
                title={t('communication.selectConversation')}
                description={t('communication.selectConversationDesc')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
