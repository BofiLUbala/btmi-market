import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/api/communication'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useI18n } from '@/store/i18n'
import { BoxIcon } from '@/components/ui/Icons'

function getNotificationIcon(type: string): React.ReactNode {
  switch (type) {
    case 'NEW_ORDER':
      return '🛍️'
    case 'ORDER_ACCEPTED':
    case 'ORDER_PREPARING':
    case 'ORDER_READY_FOR_PICKUP':
      return <BoxIcon style={{ width: 16, height: 16 }} />
    case 'COURIER_ASSIGNED':
    case 'DELIVERY_ASSIGNED':
      return '🛵'
    case 'COURIER_PICKED_UP':
    case 'DELIVERY_IN_TRANSIT':
      return '🚚'
    case 'COURIER_NEAR_DESTINATION':
      return '📍'
    case 'COURIER_ARRIVED':
      return '🏁'
    case 'DELIVERED':
      return '🎁'
    case 'BUYER_RECEIPT_REQUIRED':
      return '✍️'
    case 'ORDER_COMPLETED':
      return '✅'
    case 'ORDER_CANCELLED':
    case 'ORDER_REJECTED':
      return '❌'
    case 'DELIVERY_FAILED':
      return '⚠️'
    case 'DELIVERY_DELAYED':
      return '⏳'
    case 'PAYMENT_CONFIRMED':
      return '💳'
    case 'CASH_CONFIRMATION_REQUIRED':
      return '💵'
    case 'NEW_MESSAGE':
      return '💬'
    case 'NEW_REVIEW':
      return '⭐'
    default:
      return '🔔'
  }
}

export default function SellerNotificationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchNotifications({ limit: 50, offset: 0 })
      setItems(res.items || [])
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setMarkingAll(false)
    }
  }

  const handleClickItem = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        )
      } catch {
        // ignore error
      }
    }

    if (item.type === 'NEW_MESSAGE' && item.metadata?.order_id) {
      navigate(`/seller/messages?order_id=${item.metadata.order_id}`)
    } else if (item.reference_type === 'ORDER' && item.reference_id) {
      navigate(`/seller/orders?order_id=${item.reference_id}`)
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length

  return (
    <div className="fade-in stack" style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🔔 {t('seller.notifications')}</span>
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {unreadCount} {t('notifications.unread')}
              </span>
            )}
          </h1>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {t('communication.sellerNotifSubtitle')}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" loading={markingAll} onClick={handleMarkAll}>
            ✓ {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {error && <ErrorBox error={error} />}

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={t('notifications.empty.title')}
          description={t('notifications.empty.description')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((n) => {
            const icon = getNotificationIcon(n.type)
            return (
              <div
                key={n.id}
                onClick={() => handleClickItem(n)}
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: n.is_read ? 'var(--color-surface-1)' : 'var(--color-surface-2)',
                  border: n.is_read
                    ? '1px solid var(--color-border)'
                    : '1.5px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div
                  style={{
                    fontSize: '1.6rem',
                    lineHeight: 1,
                    padding: 8,
                    background: 'var(--color-bg)',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: n.is_read ? 600 : 800,
                        fontSize: '0.95rem',
                        color: 'var(--color-text)',
                      }}
                    >
                      {n.title}
                    </div>
                    <span className="small muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.88rem',
                      color: n.is_read ? 'var(--color-text-muted)' : 'var(--color-text)',
                      lineHeight: 1.4,
                    }}
                  >
                    {n.body}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <span
                      className="small"
                      style={{
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      {n.type === 'NEW_MESSAGE' ? t('communication.openMessage') : t('notifications.viewOrder')} →
                    </span>
                  </div>
                </div>

                {!n.is_read && (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
