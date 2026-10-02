import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notificationLink } from '@/lib/notificationLinks'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  unarchiveNotification,
  deleteNotification,
  type NotificationItem,
  type NotificationView,
} from '@/api/communication'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useI18n } from '@/store/i18n'
import { BellIcon } from '@/components/ui/Icons'
import { notificationIcon } from '@/components/ui/NotificationIcon'

const getNotificationIcon = notificationIcon

export default function SellerNotificationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [view, setView] = useState<NotificationView>('active')
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchNotifications({ limit: 50, offset: 0, audience: 'SELLER', view })
      setItems(res.items || [])
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t, view])

  useEffect(() => {
    void load()
  }, [load])

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setActingId(id)
    try {
      await archiveNotification(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  const handleUnarchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setActingId(id)
    try {
      await unarchiveNotification(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm(t('notifications.deleteConfirm'))) return
    setActingId(id)
    try {
      await deleteNotification(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead('SELLER')
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

    const link = notificationLink(item)
    if (link) {
      navigate(link)
    } else if (item.type === 'NEW_MESSAGE' && item.metadata?.order_id) {
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
            <span><BellIcon className="inline-icon" /> {t('seller.notifications')}</span>
            <Link to="/seller/notifications/settings" className="small" style={{ fontWeight: 500 }}>{t('notifSettings.link')}</Link>
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

        {view === 'active' && unreadCount > 0 && (
          <Button variant="outline" size="sm" loading={markingAll} onClick={handleMarkAll}>
            ✓ {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant={view === 'active' ? 'primary' : 'outline'} size="sm" onClick={() => setView('active')}>
          {t('notifications.tabs.active')}
        </Button>
        <Button variant={view === 'archived' ? 'primary' : 'outline'} size="sm" onClick={() => setView('archived')}>
          {t('notifications.tabs.archived')}
        </Button>
      </div>

      {error && <ErrorBox error={error} />}

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellIcon className="empty-svg" />}
          title={view === 'archived' ? t('notifications.archived.empty.title') : t('notifications.empty.title')}
          description={
            view === 'archived' ? t('notifications.archived.empty.description') : t('notifications.empty.description')
          }
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
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: n.is_read ? 'none' : 'inset 3px 0 0 var(--color-accent)',
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
                    display: 'grid',
                    placeItems: 'center',
                    width: 36,
                    height: 36,
                    flex: 'none',
                    color: 'var(--color-text)',
                    background: 'var(--color-surface-2)',
                    borderRadius: '50%',
                  }}
                >
                  {icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '2px 8px',
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

                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
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

                    {view === 'active' ? (
                      <button
                        type="button"
                        className="small muted"
                        disabled={actingId === n.id}
                        onClick={(e) => handleArchive(e, n.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        {t('notifications.archive')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="small muted"
                        disabled={actingId === n.id}
                        onClick={(e) => handleUnarchive(e, n.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        {t('notifications.unarchive')}
                      </button>
                    )}

                    <button
                      type="button"
                      className="small"
                      disabled={actingId === n.id}
                      onClick={(e) => handleDelete(e, n.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-danger, #d33)', textDecoration: 'underline' }}
                    >
                      {t('notifications.delete')}
                    </button>
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
