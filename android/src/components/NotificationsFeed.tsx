import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationAudience,
  type NotificationItem,
} from '../api/communication'
import { dismissDelivered, safeAppPath } from '../lib/push'
import { useI18n } from '../store/i18n'
import { dateLocale } from '../lib/format'
import { useColors } from '../store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../theme'

/** While the screen is open, arriving notifications show up on their own. */
const POLL_MS = 30_000

export function notificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'NEW_ORDER': return 'bag-check'
    case 'ORDER_ACCEPTED':
    case 'ORDER_PREPARING':
    case 'ORDER_READY_FOR_PICKUP': return 'cube'
    case 'COURIER_ASSIGNED':
    case 'DELIVERY_ASSIGNED': return 'bicycle'
    case 'COURIER_PICKED_UP':
    case 'DELIVERY_IN_TRANSIT': return 'car'
    case 'COURIER_NEAR_DESTINATION': return 'navigate-circle'
    case 'COURIER_ARRIVED': return 'flag'
    case 'DELIVERED': return 'gift'
    case 'BUYER_RECEIPT_REQUIRED': return 'checkmark-done-circle'
    case 'ORDER_COMPLETED': return 'checkmark-circle'
    case 'ORDER_CANCELLED':
    case 'ORDER_REJECTED': return 'close-circle'
    case 'DELIVERY_FAILED': return 'warning'
    case 'DELIVERY_DELAYED': return 'time'
    case 'PAYMENT_CONFIRMED': return 'card'
    case 'CASH_CONFIRMATION_REQUIRED': return 'cash'
    case 'NEW_MESSAGE': return 'chatbubble-ellipses'
    case 'NEW_REVIEW': return 'star'
    default: return 'notifications'
  }
}

type Tab = 'new' | 'history'

/**
 * One notification list for all three spaces (buyer, seller, courier), each
 * asking only for its own audience so a seller alert never opens a buyer
 * screen.
 *
 * Two tabs, because a notification has two jobs. "Nouvelles" is the stack of
 * what has arrived and not been read yet, newest on top: reading one opens it
 * and it leaves the stack at once, so what is left is always what still needs
 * attention. "Historique" keeps every notification, read ones included, so
 * nothing is ever lost by reading it.
 *
 * The list reloads whenever the screen comes back into focus and every 30 s
 * while it is open, so an arriving notification appears without a pull.
 */
export function NotificationsFeed({ audience, space, unreadQueryKey, onBack }: {
  audience: NotificationAudience
  /** Which notification-settings space the gear opens. */
  space: 'buyer' | 'seller' | 'courier'
  /** Query key of the bell count to refresh after a read. */
  unreadQueryKey: readonly unknown[]
  /** Shown as a back arrow when this screen was pushed onto a stack. */
  onBack?: () => void
}) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('new')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState('')

  const refreshBell = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: unreadQueryKey })
  }, [queryClient]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (which: Tab, silent = false) => {
    if (!silent) setLoading(true)
    try {
      // 'unread' is the stack; 'active' is everything that was not archived.
      const res = await fetchNotifications({ limit: 50, offset: 0, audience, view: which === 'new' ? 'unread' : 'active' })
      // The server already orders by arrival, newest first; sorting here keeps
      // that true whatever the caller or a cache hands back.
      const list = [...(res.items || [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      setItems(list)
      setUnreadTotal(which === 'new' ? list.length : list.filter((n) => !n.is_read).length)
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [audience, t])

  // Reload on focus, then keep polling while the screen stays open.
  useFocusEffect(useCallback(() => {
    void load(tab)
    const id = setInterval(() => void load(tab, true), POLL_MS)
    return () => clearInterval(id)
  }, [load, tab]))

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    setItems([])
    void load(next)
  }

  const onRefresh = () => {
    setRefreshing(true)
    void load(tab, true)
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead(audience)
      refreshBell()
      setUnreadTotal(0)
      // Read is read: the stack empties, the history keeps them all.
      if (tab === 'new') setItems([])
      else setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })))
      void dismissDelivered('all')
    } catch {
      // A failed mark-all leaves the list as it is; the next load re-reads it.
    } finally {
      setMarkingAll(false)
    }
  }

  const handleItemPress = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
        refreshBell()
        setUnreadTotal((n) => Math.max(0, n - 1))
      } catch {
        // Opening it still counts: the read is retried by the next load.
      }
      void dismissDelivered([item.id])
    }
    // Reading drops it from the stack; in the history it only turns read.
    if (tab === 'new') setItems((prev) => prev.filter((n) => n.id !== item.id))
    else setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)))

    // The server resolves the screen each notification opens.
    const appLink = safeAppPath(typeof item.metadata?.app_link === 'string' ? item.metadata.app_link : undefined)
    if (appLink) {
      router.push(appLink as any)
    } else if (item.type === 'NEW_MESSAGE' && item.metadata?.order_id) {
      router.push(`/orders/${item.metadata.order_id}` as any)
    } else if (item.reference_type === 'ORDER' && item.reference_id) {
      router.push(`/orders/${item.reference_id}` as any)
    }
  }

  const formatDateTime = (val: string) => {
    try {
      return new Date(val).toLocaleDateString(dateLocale(lang), {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch {
      return ''
    }
  }

  // Aujourd'hui / Cette semaine / Plus tôt, from each notification's own
  // timestamp. Inside a group the newest stays on top.
  type Row = { kind: 'header'; key: string; label: string } | { kind: 'item'; key: string; item: NotificationItem }
  const rows = useMemo<Row[]>(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const weekAgo = startOfToday.getTime() - 6 * 86_400_000
    const groups: Array<{ key: string; label: string; items: NotificationItem[] }> = [
      { key: 'today', label: t('notifications.groupToday'), items: [] },
      { key: 'week', label: t('notifications.groupWeek'), items: [] },
      { key: 'earlier', label: t('notifications.groupEarlier'), items: [] },
    ]
    for (const n of items) {
      const at = Date.parse(n.created_at)
      groups[at >= startOfToday.getTime() ? 0 : at >= weekAgo ? 1 : 2].items.push(n)
    }
    return groups.flatMap((g) => g.items.length
      ? [{ kind: 'header' as const, key: `h-${g.key}`, label: g.label }, ...g.items.map((item) => ({ kind: 'item' as const, key: item.id, item }))]
      : [])
  }, [items, t])

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'header') return <Text style={styles.groupLabel}>{row.label}</Text>
    const item = row.item
    return (
      <TouchableOpacity style={[styles.itemCard, item.is_read && styles.itemCardRead]} onPress={() => void handleItemPress(item)} activeOpacity={0.7}>
        <View style={[styles.iconContainer, item.is_read ? styles.iconContainerRead : styles.iconContainerUnread]}>
          <Ionicons name={notificationIcon(item.type)} size={19} color={item.is_read ? colors.muted : colors.green} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>{item.title}</Text>
            {!item.is_read ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.bodyText} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.dateText}>{formatDateTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {onBack ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.pageTitle}>{t('notifications.title')}</Text>
          {unreadTotal > 0 ? (
            <View style={styles.counterBadge}><Text style={styles.counterText}>{unreadTotal}</Text></View>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('notifSettings.title')}
            onPress={() => router.push({ pathname: '/notification-settings', params: { space } })}
            hitSlop={10}
          >
            <Ionicons name="settings-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
        {unreadTotal > 0 ? (
          <TouchableOpacity onPress={() => void handleMarkAll()} disabled={markingAll} style={styles.markAllBtn}>
            {markingAll ? <ActivityIndicator size="small" color={colors.green} /> : <Text style={styles.markAllText}>{t('notifications.markAll')}</Text>}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {([['new', t('notifications.tabNew')], ['history', t('notifications.tabHistory')]] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => switchTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
              {label}{key === 'new' && unreadTotal > 0 ? ` (${unreadTotal})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      {loading && !items.length ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name={tab === 'new' ? 'notifications-off-outline' : 'time-outline'} size={48} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{tab === 'new' ? t('notifications.empty') : t('notifications.historyEmpty')}</Text>
          <Text style={styles.emptyDesc}>{tab === 'new' ? t('notifications.allReadDesc') : t('notifications.historyEmptyDesc')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        />
      )}
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs, backgroundColor: colors.cream,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pageTitle: { fontSize: 21, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  counterBadge: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  counterText: { color: colors.onGreen, fontSize: 11, fontWeight: '800' },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { color: colors.green, fontSize: 12.5, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  tab: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  tabTextOn: { color: colors.white },
  groupLabel: { ...kicker, color: colors.muted, marginTop: 8, marginBottom: -2 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: 10 },
  itemCard: {
    flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    gap: 12, alignItems: 'flex-start', ...shadow.card,
  },
  itemCardRead: { backgroundColor: colors.surface2 },
  iconContainer: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconContainerUnread: { backgroundColor: colors.greenSoft },
  iconContainerRead: { backgroundColor: colors.surface2 },
  contentContainer: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title: { fontSize: 13.5, fontWeight: '700', color: colors.ink, flex: 1 },
  titleUnread: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginLeft: 8 },
  bodyText: { fontSize: 12.5, color: colors.muted, lineHeight: 17, marginTop: 1 },
  dateText: { fontSize: 11, color: colors.faint, marginTop: 6 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  loadingText: { fontSize: 13, color: colors.muted },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', maxWidth: 260 },
  errorBox: { backgroundColor: colors.dangerSoft, padding: 10, margin: spacing.md, borderRadius: radius.sm },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center' },
})
