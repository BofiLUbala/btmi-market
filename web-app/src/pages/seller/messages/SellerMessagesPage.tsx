import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchSellerConversations, type ConversationListItem } from '@/api/communication'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { useOrderEvents } from '@/lib/orderEvents'
import { ErrorBox } from '@/components/ui/Feedback'
import { ChatIcon } from '@/components/ui/Icons'
import { ConversationInbox } from '@/components/communication/ConversationInbox'

/**
 * The seller's order messages: TBK support and the courier, per order. Sellers
 * never write to buyers (TBK relays), so rows are not titled with the buyer.
 */
export default function SellerMessagesPage() {
  const { t } = useI18n()
  const { activeShop, activeBusiness } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrderId = searchParams.get('order_id') || ''

  const [items, setItems] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [onlyWithMessages, setOnlyWithMessages] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchSellerConversations({
        shop_id: activeShop || undefined,
        business_id: activeBusiness?.id || undefined,
        with_messages: onlyWithMessages,
        limit: 100,
        offset: 0,
      })
      setItems(res.items || [])
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeShop, activeBusiness?.id, onlyWithMessages, t])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 30_000)
    return () => clearInterval(timer)
  }, [load])
  // A new message or order change refreshes the list (previews, unread badges).
  useOrderEvents(() => void load(true))

  const select = useCallback((orderId: string) => setSearchParams({ order_id: orderId }), [setSearchParams])
  const back = useCallback(() => setSearchParams({}), [setSearchParams])

  return (
    <div className="fade-in">
      <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ChatIcon className="inline-icon" /> {t('seller.messages')}
      </h1>
      <p className="small muted" style={{ margin: '2px 0 12px' }}>{t('communication.sellerSubtitle')}</p>
      {error && <ErrorBox error={error} onRetry={() => void load()} />}
      <ConversationInbox
        me="SELLER"
        items={items}
        loading={loading}
        selectedOrderId={selectedOrderId}
        onSelect={select}
        onBack={back}
        search={search}
        onSearch={setSearch}
        onlyWithMessages={onlyWithMessages}
        onOnlyWithMessages={setOnlyWithMessages}
        subtitle={(c) => c.shop_name}
      />
    </div>
  )
}
