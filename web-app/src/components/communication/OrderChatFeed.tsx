import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  fetchOrderConversation,
  sendOrderMessage,
  fetchAdminOrderConversation,
  adminInterveneOrder,
  type ChatParty,
  type OrderConversationDetail,
  type OrderMessage,
} from '@/api/communication'
import { formatDateTime } from '@/lib/format'
import { useOrderEvents } from '@/lib/orderEvents'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorBox } from '@/components/ui/Feedback'
import { ApiError } from '@/api/types'
import { useI18n } from '@/store/i18n'
import { BuildingIcon, ChatIcon, CustomerIcon, ShieldCheckIcon, StoreIcon } from '@/components/ui/Icons'

interface OrderChatFeedProps {
  orderId: string
  role: ChatParty
  onClose?: () => void
  showHeader?: boolean
}

const PARTY_LABEL: Record<ChatParty, string> = {
  BUYER: 'Acheteur',
  SELLER: 'Vendeur',
  COURIER: 'Livreur',
  ADMIN: 'Support TBK',
}

/** Party name inside a French sentence: "le support TBK", "livreur"… */
function partyInSentence(party: ChatParty): string {
  return party === 'ADMIN' ? 'le support TBK' : PARTY_LABEL[party].toLowerCase()
}

function PartyIcon({ party }: { party: ChatParty }) {
  if (party === 'ADMIN') return <ShieldCheckIcon className="inline-icon" />
  if (party === 'SELLER') return <StoreIcon className="inline-icon" />
  return <CustomerIcon className="inline-icon" />
}

/**
 * Private order channels. Each contact tab is a two-party thread: what the
 * buyer writes to TBK is read by TBK only, never by the seller or the courier.
 * The server returns only the caller's own channels and refuses forbidden
 * pairs (buyer ↔ seller); this component only arranges them.
 */
export function OrderChatFeed({ orderId, role, onClose, showHeader = true }: OrderChatFeedProps) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<OrderConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inputBody, setInputBody] = useState('')
  const [sending, setSending] = useState(false)
  const [contact, setContact] = useState<ChatParty | ''>('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const loadConversation = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = role === 'ADMIN'
          ? await fetchAdminOrderConversation(orderId)
          : await fetchOrderConversation(orderId, role)
        setDetail({ ...res, messages: res?.messages || [], contacts: res?.contacts || [] })
        setError('')
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [orderId, role, t]
  )

  useEffect(() => {
    void loadConversation()
    const timer = setInterval(() => void loadConversation(true), 15_000)
    return () => clearInterval(timer)
  }, [loadConversation])

  // New messages are pushed with the order's events.
  useOrderEvents(() => void loadConversation(true), { orderId, audience: role === 'ADMIN' ? 'admin' : 'user' })

  const contacts = detail?.contacts ?? []
  useEffect(() => {
    if (!contact && contacts.length > 0) {
      const withUnread = contacts.find((c) => c.unread > 0 && c.available)
      setContact((withUnread ?? contacts.find((c) => c.available) ?? contacts[0]).party)
    }
  }, [contacts, contact])

  const me = detail?.my_party ?? role
  const thread = useMemo(
    () => (detail?.messages ?? []).filter((m) =>
      contact !== '' &&
      ((m.sender_party === me && m.recipient_party === contact) ||
        (m.sender_party === contact && m.recipient_party === me))
    ),
    [detail?.messages, contact, me]
  )
  const selected = contacts.find((c) => c.party === contact)
  // The courier channel stays writable before assignment: the courier reads it once assigned.
  const canWrite = !!selected && (selected.available || selected.party === 'COURIER')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, contact])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputBody.trim()
    if (!trimmed || sending || !contact) return
    setSending(true)
    setError('')
    try {
      if (role === 'ADMIN') {
        await adminInterveneOrder(orderId, trimmed, contact as Exclude<ChatParty, 'ADMIN'>)
      } else {
        await sendOrderMessage(orderId, trimmed, contact, role)
      }
      setInputBody('')
      await loadConversation(true)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : t('common.error'))
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
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span><ChatIcon className="inline-icon" /> {t('communication.channelTitle')}</span>
              {detail?.order_number && (
                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>#{detail.order_number}</span>
              )}
              {detail?.order_status && <StatusBadge status={detail.order_status} />}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {detail?.shop_name && <span><StoreIcon className="inline-icon" /> {detail.shop_name}</span>}
              {detail?.business_name && role === 'ADMIN' && (
                <span style={{ marginLeft: 8 }}><BuildingIcon className="inline-icon" /> {detail.business_name}</span>
              )}
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          )}
        </div>
      )}

      {/* One tab per private channel */}
      <div role="tablist" aria-label="Destinataire" style={{ display: 'flex', gap: 6, padding: '10px 12px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {contacts.map((c) => {
          const active = c.party === contact
          return (
            <button
              key={c.party}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setContact(c.party)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: active ? 'var(--color-on-primary)' : 'var(--color-text)',
                opacity: c.available ? 1 : 0.6,
              }}
            >
              <PartyIcon party={c.party} /> {PARTY_LABEL[c.party]}
              {c.unread > 0 && (
                <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 9, background: active ? 'var(--color-on-primary)' : 'var(--color-primary)', color: active ? 'var(--color-primary)' : 'var(--color-on-primary)', fontSize: 11 }}>
                  {c.unread}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="small muted" style={{ padding: '6px 16px', borderBottom: '1px solid var(--color-border)' }}>
          Conversation privée avec {partyInSentence(selected.party)}
          {selected.name && selected.name.toLowerCase() !== PARTY_LABEL[selected.party].toLowerCase() ? ` (${selected.name})` : ''} : personne d’autre ne la voit.
        </div>
      )}

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
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        )}

        {error && <ErrorBox error={error} />}

        {!loading && thread.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            <div style={{ marginBottom: 8 }}><ChatIcon className="empty-svg" /></div>
            <div style={{ fontWeight: 600 }}>{t('communication.emptyChatTitle')}</div>
            <div className="small">
              {selected && !selected.available
                ? 'Aucun livreur n’est encore assigné : votre message lui sera transmis dès son affectation.'
                : t('communication.emptyChatDesc')}
            </div>
          </div>
        )}

        {thread.map((msg: OrderMessage) => {
          const isMe = msg.sender_party === me
          const isAdmin = msg.sender_party === 'ADMIN'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
              <div
                className="small"
                style={{
                  marginBottom: 2,
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: isAdmin ? 'var(--color-warning-text, #b45309)' : 'var(--color-text-muted)',
                  fontWeight: isAdmin ? 700 : 500,
                  fontSize: '0.75rem',
                }}
              >
                <span>
                  <PartyIcon party={msg.sender_party} />{' '}
                  {isMe ? t('communication.you') : isAdmin ? 'Support TBK' : msg.sender_name || PARTY_LABEL[msg.sender_party]}
                </span>
                <span>• {formatDateTime(msg.created_at)}</span>
                {isMe && msg.recipient_read_at && <span>• lu</span>}
              </div>
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  ...(isAdmin && !isMe
                    ? {
                        background: 'var(--color-warning-subtle, #fef3c7)',
                        color: 'var(--color-warning-text, #92400e)',
                        border: '1.5px solid var(--color-warning, #f59e0b)',
                      }
                    : isMe
                      ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderBottomRightRadius: 2 }
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

      <form
        onSubmit={handleSend}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface-1)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        <textarea
          rows={2}
          value={inputBody}
          onChange={(e) => setInputBody(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canWrite}
          placeholder={selected ? `Message privé ${selected.party === 'ADMIN' ? 'au support TBK' : `à ${partyInSentence(selected.party)}`}…` : t('communication.inputPlaceholder')}
          style={{
            // Keeps a readable width; on narrow cards the send button wraps below.
            flex: '1 1 200px',
            minWidth: 0,
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
          disabled={!inputBody.trim() || !canWrite}
          variant={role === 'ADMIN' ? 'accent' : 'primary'}
          style={{ height: 42, paddingLeft: 16, paddingRight: 16 }}
        >
          {t('communication.send')}
        </Button>
      </form>
    </div>
  )
}
