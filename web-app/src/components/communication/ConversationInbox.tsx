import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ChatParty, ConversationListItem } from '@/api/communication'
import { lastMessageAuthor } from '@/lib/chat'
import { StatusBadge } from '@/components/ui/Badges'
import { useI18n } from '@/store/i18n'
import { dateLocale } from '@/lib/format'
import type { TranslationKey } from '@/locales/fr'
import { OrderChatFeed } from './OrderChatFeed'
import './chat.css'

const NARROW_QUERY = '(max-width: 899px)'

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

interface Props {
  /** The viewer's side: SELLER inbox or Commerce Admin (ADMIN). */
  me: Extract<ChatParty, 'SELLER' | 'ADMIN'>
  items: ConversationListItem[]
  loading: boolean
  selectedOrderId: string
  onSelect: (orderId: string) => void
  onBack: () => void
  search: string
  onSearch: (q: string) => void
  onlyWithMessages: boolean
  onOnlyWithMessages: (v: boolean) => void
  /** Extra filters or actions under the search box (admin status filter). */
  tools?: ReactNode
  /** Extra actions above the open conversation (admin: open the order). */
  chatActions?: ReactNode
  /** Second line of a row: who the order is for. */
  subtitle: (item: ConversationListItem) => string
}

/**
 * List + conversation. Wide screens show both; phones show the list, then the
 * conversation full width with a back arrow, never two cramped columns.
 */
export function ConversationInbox(props: Props) {
  const { me, items, loading, selectedOrderId, onSelect, onBack, search, onSearch, onlyWithMessages, onOnlyWithMessages, tools, chatActions, subtitle } = props
  const { t, lang } = useI18n()
  const narrow = useNarrow()
  const locale = dateLocale(lang)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => [c.order_number, c.buyer_name, c.shop_name, c.last_message].some((v) => (v || '').toLowerCase().includes(q)))
  }, [items, search])

  // Wide screens open the first conversation; phones start on the list.
  useEffect(() => {
    if (!narrow && !selectedOrderId && filtered.length) onSelect(filtered[0].order_id)
  }, [narrow, selectedOrderId, filtered, onSelect])

  const when = (iso: string) => {
    const d = new Date(iso)
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }
  const party = (p?: ChatParty) => (p ? t(`chat.party.${p}` as TranslationKey) : '')

  const preview = (c: ConversationListItem) => {
    const author = lastMessageAuthor(c, me)
    if (author.kind === 'none') return <span>{t('inbox.noMessages')}</span>
    const who = author.kind === 'me' ? t('inbox.youTo', { party: party(author.to) }) : party(author.from)
    return <><b>{who} :</b> {c.last_message}</>
  }

  return (
    <div className="inbox" data-open={narrow && selectedOrderId ? 'true' : 'false'}>
      <div className="inbox-pane inbox-list">
        <div className="inbox-tools">
          <input type="search" className="inbox-search" placeholder={t('inbox.search')} value={search} onChange={(e) => onSearch(e.target.value)} />
          <div className="inbox-filter" role="group">
            <button type="button" aria-pressed={onlyWithMessages} onClick={() => onOnlyWithMessages(true)}>{t('inbox.withMessages')}</button>
            <button type="button" aria-pressed={!onlyWithMessages} onClick={() => onOnlyWithMessages(false)}>{t('inbox.allOrders')}</button>
          </div>
          {tools}
        </div>
        <div className="inbox-items">
          {loading && !items.length ? (
            <div className="inbox-empty">{t('common.loading')}</div>
          ) : !filtered.length ? (
            <div className="inbox-empty">{onlyWithMessages ? t('inbox.emptyWithMessages') : t('inbox.empty')}</div>
          ) : filtered.map((c) => (
            <button key={c.conversation_id} type="button" className="inbox-item" aria-current={c.order_id === selectedOrderId} onClick={() => onSelect(c.order_id)}>
              <div className="inbox-row">
                <span className="inbox-order">#{c.order_number || c.order_id.slice(0, 8)}</span>
                <span className="inbox-time">{when(c.last_message_at || c.created_at)}</span>
              </div>
              <div className="inbox-row">
                <span className="inbox-sub">{subtitle(c)}</span>
                <StatusBadge status={c.order_status} />
              </div>
              <div className="inbox-row">
                <span className={`inbox-preview${c.unread_count > 0 ? ' unread' : ''}`}>{preview(c)}</span>
                {c.unread_count > 0 && <span className="chat-badge">{c.unread_count}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="inbox-pane inbox-chat">
        {selectedOrderId ? (
          <>
            {chatActions}
            <div style={{ flex: 1, minHeight: 0 }}>
              <OrderChatFeed key={selectedOrderId} orderId={selectedOrderId} role={me} onBack={narrow ? onBack : undefined} />
            </div>
          </>
        ) : (
          <div className="inbox-placeholder">{t('inbox.pick')}</div>
        )}
      </div>
    </div>
  )
}
