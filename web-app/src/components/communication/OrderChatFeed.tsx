import { useEffect, useRef, useState, useCallback } from 'react'
import {
  fetchOrderConversation,
  sendOrderMessage,
  fetchAdminOrderConversation,
  adminInterveneOrder,
  type OrderConversationDetail,
  type OrderMessage,
} from '@/api/communication'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorBox } from '@/components/ui/Feedback'
import { useI18n } from '@/store/i18n'

interface OrderChatFeedProps {
  orderId: string
  role: 'BUYER' | 'SELLER' | 'ADMIN'
  onClose?: () => void
  showHeader?: boolean
}

export function OrderChatFeed({
  orderId,
  role,
  onClose,
  showHeader = true,
}: OrderChatFeedProps) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<OrderConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inputBody, setInputBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadConversation = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        let res: OrderConversationDetail
        if (role === 'ADMIN') {
          res = await fetchAdminOrderConversation(orderId)
        } else {
          res = await fetchOrderConversation(orderId)
        }
        setDetail(res)
        setError('')
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [orderId, role, t]
  )

  useEffect(() => {
    void loadConversation()
    pollTimerRef.current = setInterval(() => {
      void loadConversation(true)
    }, 6000)

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [loadConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (detail?.messages) {
      scrollToBottom()
    }
  }, [detail?.messages?.length])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputBody.trim()
    if (!trimmed || sending) return

    setSending(true)
    setError('')
    try {
      if (role === 'ADMIN') {
        await adminInterveneOrder(orderId, trimmed)
      } else {
        await sendOrderMessage(orderId, trimmed)
      }
      setInputBody('')
      await loadConversation(true)
      scrollToBottom()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div
      className="order-chat-feed"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 480,
        background: 'var(--color-surface-1)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {showHeader && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💬 {t('communication.channelTitle')}</span>
              {detail?.order_number && (
                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                  #{detail.order_number}
                </span>
              )}
              {detail?.order_status && <StatusBadge status={detail.order_status} />}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {detail?.shop_name && (
                <span>🏪 {detail.shop_name}</span>
              )}
              {detail?.buyer_name && role !== 'BUYER' && (
                <span style={{ marginLeft: 8 }}>👤 {detail.buyer_name}</span>
              )}
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--color-bg)',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
            {t('common.loading')}
          </div>
        )}

        {error && <ErrorBox error={error} />}

        {!loading && (!detail?.messages || detail.messages.length === 0) && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 600 }}>{t('communication.emptyChatTitle')}</div>
            <div className="small">{t('communication.emptyChatDesc')}</div>
          </div>
        )}

        {detail?.messages?.map((msg: OrderMessage) => {
          const isMe =
            (role === 'BUYER' && msg.sender_type === 'BUYER') ||
            (role === 'SELLER' && (msg.sender_type === 'SELLER' || msg.sender_type === 'EMPLOYEE')) ||
            (role === 'ADMIN' && (msg.sender_type === 'COMMERCE_ADMIN' || msg.sender_type === 'SUPER_ADMIN'))

          const isAdmin =
            msg.is_admin_intervention ||
            msg.sender_type === 'COMMERCE_ADMIN' ||
            msg.sender_type === 'SUPER_ADMIN'

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              {/* Sender label */}
              <div
                className="small"
                style={{
                  marginBottom: 2,
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: isAdmin
                    ? 'var(--color-warning-text, #b45309)'
                    : 'var(--color-text-muted)',
                  fontWeight: isAdmin ? 700 : 500,
                  fontSize: '0.75rem',
                }}
              >
                {isAdmin && <span>🛡️ [TBK Admin / Intervention]</span>}
                {!isAdmin && msg.sender_type === 'BUYER' && <span>👤 {isMe ? t('communication.you') : msg.sender_name || t('communication.buyer')}</span>}
                {!isAdmin && (msg.sender_type === 'SELLER' || msg.sender_type === 'EMPLOYEE') && (
                  <span>🏪 {isMe ? t('communication.you') : msg.sender_name || detail?.shop_name || t('communication.seller')}</span>
                )}
                <span>• {formatDateTime(msg.created_at)}</span>
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  ...(isAdmin
                    ? {
                        background: 'var(--color-warning-subtle, #fef3c7)',
                        color: 'var(--color-warning-text, #92400e)',
                        border: '1.5px solid var(--color-warning, #f59e0b)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }
                    : isMe
                      ? {
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderBottomRightRadius: 2,
                        }
                      : {
                          background: 'var(--color-surface-2)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          borderBottomLeftRadius: 2,
                        }),
                }}
              >
                {msg.body}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input composer */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface-1)',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          rows={2}
          value={inputBody}
          onChange={(e) => setInputBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            role === 'ADMIN'
              ? t('communication.adminInputPlaceholder')
              : t('communication.inputPlaceholder')
          }
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />
        <Button
          type="submit"
          loading={sending}
          disabled={!inputBody.trim()}
          variant={role === 'ADMIN' ? 'accent' : 'primary'}
          style={{ height: 42, paddingLeft: 16, paddingRight: 16 }}
        >
          {role === 'ADMIN' ? t('communication.interveneSend') : t('communication.send')}
        </Button>
      </form>
    </div>
  )
}
