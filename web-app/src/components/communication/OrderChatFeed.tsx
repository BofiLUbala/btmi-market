import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  adminInterveneOrder,
  adminMarkChannelRead,
  fetchAdminOrderConversation,
  fetchOrderConversation,
  markChannelRead,
  sendOrderMessage,
  type ChatParty,
  type OrderConversationDetail,
  type OrderMessage,
} from '@/api/communication'
import { useOrderEvents } from '@/lib/orderEvents'
import { canWriteTo, groupByDay, initialContact, startsRun, threadWith } from '@/lib/chat'
import { StatusBadge } from '@/components/ui/Badges'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import './chat.css'

interface OrderChatFeedProps {
  orderId: string
  role: ChatParty
  onClose?: () => void
  /** A back arrow instead of a close cross (inbox on a phone). */
  onBack?: () => void
  showHeader?: boolean
}

/** A message typed here and not yet confirmed by the server. */
interface Pending { key: string; body: string; to: ChatParty; failed: boolean; at: string }

const POLL_MS = 15_000
const partyKey = (p: ChatParty) => `chat.party.${p}` as TranslationKey
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/**
 * Private order channels, one tab per two-party thread. What the buyer writes
 * to TBK is read by TBK only, never by the seller or the courier: the server
 * returns only the caller's own channels and refuses buyer <-> seller.
 *
 * Nothing is marked read by fetching: only the thread on screen, while the
 * page is visible, so a background refresh never swallows unread messages.
 */
export function OrderChatFeed({ orderId, role, onClose, onBack, showHeader = true }: OrderChatFeedProps) {
  const { t, lang } = useI18n()
  const [detail, setDetail] = useState<OrderConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [draft, setDraft] = useState('')
  const [contact, setContact] = useState<ChatParty | ''>('')
  const [pending, setPending] = useState<Pending[]>([])
  const threadRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickToBottom = useRef(true)
  const admin = role === 'ADMIN'

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = admin ? await fetchAdminOrderConversation(orderId) : await fetchOrderConversation(orderId, role)
      setDetail({ ...res, messages: res?.messages || [], contacts: res?.contacts || [] })
      setLoadError('')
    } catch (err) {
      if (!silent) setLoadError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [orderId, role, admin, t])

  useEffect(() => { void load() }, [load])

  // New messages arrive with the order's events; polling (visible tab only) is the fallback.
  useOrderEvents(() => void load(true), { orderId, audience: admin ? 'admin' : 'user' })
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const contacts = detail?.contacts ?? []
  useEffect(() => {
    if (!contact && contacts.length) setContact(initialContact(contacts))
  }, [contacts, contact])

  const me = detail?.my_party ?? role
  const selected = contacts.find((c) => c.party === contact)
  const writable = canWriteTo(selected)
  const thread = useMemo(() => threadWith(detail?.messages ?? [], me, contact), [detail?.messages, me, contact])
  const pendingHere = pending.filter((p) => p.to === contact)

  // The open thread is read once it is actually on screen.
  const unreadHere = selected?.unread ?? 0
  useEffect(() => {
    if (!contact || unreadHere === 0) return
    const markRead = () => {
      if (document.visibilityState !== 'visible') return
      const done = admin ? adminMarkChannelRead(orderId, contact) : markChannelRead(orderId, contact, role)
      void done.then(() => setDetail((d) => d && { ...d, contacts: d.contacts.map((c) => (c.party === contact ? { ...c, unread: 0 } : c)) })).catch(() => undefined)
    }
    markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [contact, unreadHere, orderId, role, admin])

  // Follow the bottom of the thread unless the reader scrolled up to read history.
  const onScroll = () => {
    const el = threadRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useLayoutEffect(() => {
    const el = threadRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [thread.length, pendingHere.length, contact])
  useEffect(() => { stickToBottom.current = true }, [contact])

  // The composer grows with the text, up to its max height.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    // Empty: the CSS height (one line); a wrapped placeholder must not grow it.
    if (!draft) { el.style.height = ''; return }
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  const deliver = async (p: Pending) => {
    try {
      if (admin) await adminInterveneOrder(orderId, p.body, p.to as Exclude<ChatParty, 'ADMIN'>)
      else await sendOrderMessage(orderId, p.body, p.to, role)
      await load(true)
      setPending((list) => list.filter((x) => x.key !== p.key))
    } catch (err) {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: true } : x)))
      setSendError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const send = () => {
    const body = draft.trim()
    if (!body || !contact || !writable) return
    const p: Pending = { key: `${Date.now()}-${Math.random()}`, body, to: contact, failed: false, at: new Date().toISOString() }
    setPending((list) => [...list, p])
    setDraft('')
    setSendError('')
    stickToBottom.current = true
    void deliver(p)
  }

  const retry = (p: Pending) => {
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: false } : x)))
    setSendError('')
    void deliver({ ...p, failed: false })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a keyboard; on a phone it is a new line and the button sends.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !coarsePointer()) {
      e.preventDefault()
      send()
    }
  }

  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const dayLabel = (day: string) => {
    const today = new Date()
    const d = new Date(`${day}T12:00:00`)
    const yesterday = new Date(today.getTime() - 86_400_000)
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
    if (sameDay(d, today)) return t('chat.today')
    if (sameDay(d, yesterday)) return t('chat.yesterday')
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const contactLabel = (p: ChatParty) => t(partyKey(p))
  const senderLabel = (m: OrderMessage) => (m.sender_party === 'ADMIN' ? t('chat.party.ADMIN') : m.sender_name || contactLabel(m.sender_party))

  return (
    <section className="chat" aria-label={t('chat.title')}>
      {showHeader && (
        <header className="chat-head">
          {onBack && <button type="button" className="chat-icon-btn" onClick={onBack} aria-label={t('chat.back')}>←</button>}
          <div className="chat-head-main">
            <div className="chat-head-title">
              <span>#{detail?.order_number || orderId.slice(0, 8).toUpperCase()}</span>
              {detail?.order_status && <StatusBadge status={detail.order_status} />}
            </div>
            <div className="chat-head-sub">
              {[detail?.shop_name, admin ? detail?.buyer_name : ''].filter(Boolean).join(' · ')}
            </div>
          </div>
          {onClose && <button type="button" className="chat-icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>}
        </header>
      )}

      <div className="chat-tabs" role="tablist" aria-label={t('chat.recipients')}>
        {contacts.map((c) => {
          const name = c.name && c.party !== 'ADMIN' && c.name.toLowerCase() !== contactLabel(c.party).toLowerCase() ? c.name : ''
          return (
            <button key={c.party} type="button" role="tab" className="chat-tab" aria-selected={c.party === contact} onClick={() => { setContact(c.party); setSendError('') }}>
              {contactLabel(c.party)}
              {name && <span className="chat-tab-name">· {name}</span>}
              {c.unread > 0 && <span className="chat-badge" aria-label={t('chat.unread', { count: c.unread })}>{c.unread}</span>}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="chat-privacy">
          🔒 {t('chat.privacy', { party: contactLabel(selected.party) })}
        </div>
      )}

      <div className="chat-thread" ref={threadRef} onScroll={onScroll} aria-live="polite">
        {loading && !detail ? (
          <div className="chat-empty">{t('common.loading')}</div>
        ) : loadError && !detail ? (
          <div className="chat-empty"><strong>{t('chat.loadFailed')}</strong><button type="button" className="chat-retry" onClick={() => void load()}>{t('chat.retry')}</button></div>
        ) : thread.length === 0 && pendingHere.length === 0 ? (
          <div className="chat-empty">
            <strong>{t('chat.emptyTitle')}</strong>
            {selected && !selected.available && selected.party === 'COURIER' ? t('chat.courierNotAssigned') : t('chat.emptyDesc', { party: selected ? contactLabel(selected.party) : '' })}
          </div>
        ) : (
          <>
            {groupByDay(thread).map((g) => (
              <div key={g.day} style={{ display: 'contents' }}>
                <div className="chat-day">{dayLabel(g.day)}</div>
                {g.messages.map((m, i) => {
                  const mine = m.sender_party === me
                  const run = startsRun(g.messages[i - 1], m)
                  return (
                    <div key={m.id} className={`chat-msg ${mine ? 'mine' : 'theirs'}${run ? ' run' : ''}${m.sender_party === 'ADMIN' && !mine ? ' tbk' : ''}`}>
                      {run && !mine && <div className="chat-sender">{m.sender_party === 'ADMIN' ? '🛡️ ' : ''}{senderLabel(m)}</div>}
                      <div className="chat-bubble">{m.body}</div>
                      <div className="chat-meta">
                        {time(m.created_at)}
                        {mine && (m.recipient_read_at ? ` · ${t('chat.read')}` : ` · ${t('chat.sent')}`)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {pendingHere.map((p) => (
              <div key={p.key} className={`chat-msg mine run${p.failed ? ' failed' : ''}`}>
                <div className="chat-bubble">{p.body}</div>
                <div className="chat-meta">
                  {p.failed
                    ? <button type="button" className="chat-retry" onClick={() => retry(p)}>{t('chat.notSent')}</button>
                    : t('chat.sending')}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {sendError && <div className="chat-error" role="alert">{sendError}</div>}
      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); send() }}>
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!writable}
          aria-label={t('chat.inputLabel')}
          placeholder={selected ? t('chat.placeholder', { party: contactLabel(selected.party) }) : t('chat.pickRecipient')}
        />
        <button type="submit" className="chat-send" disabled={!draft.trim() || !writable} aria-label={t('chat.send')}>
          {t('chat.send')}
        </button>
      </form>
    </section>
  )
}
