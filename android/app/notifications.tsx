import { useEffect, useState, useCallback, useMemo } from 'react'
import { dismissDelivered, safeAppPath } from '../src/lib/push'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../src/api/communication'
import { useI18n } from '../src/store/i18n'
import { dateLocale } from '../src/lib/format'
import { useColors } from '../src/store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../src/theme'
import { AccountShell } from '../src/components/AccountShell'

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'NEW_ORDER':
      return 'bag-check'
    case 'ORDER_ACCEPTED':
    case 'ORDER_PREPARING':
    case 'ORDER_READY_FOR_PICKUP':
      return 'cube'
    case 'COURIER_ASSIGNED':
    case 'DELIVERY_ASSIGNED':
      return 'bicycle'
    case 'COURIER_PICKED_UP':
    case 'DELIVERY_IN_TRANSIT':
      return 'car'
    case 'COURIER_NEAR_DESTINATION':
      return 'navigate-circle'
    case 'COURIER_ARRIVED':
      return 'flag'
    case 'DELIVERED':
      return 'gift'
    case 'BUYER_RECEIPT_REQUIRED':
      return 'checkmark-done-circle'
    case 'ORDER_COMPLETED':
      return 'checkmark-circle'
    case 'ORDER_CANCELLED':
    case 'ORDER_REJECTED':
      return 'close-circle'
    case 'DELIVERY_FAILED':
      return 'warning'
    case 'DELIVERY_DELAYED':
      return 'time'
    case 'PAYMENT_CONFIRMED':
      return 'card'
    case 'CASH_CONFIRMATION_REQUIRED':
      return 'cash'
    case 'NEW_MESSAGE':
      return 'chatbubble-ellipses'
    case 'NEW_REVIEW':
      return 'star'
    default:
      return 'notifications'
  }
}

function NotificationsScreen() {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  // The home bell and the account row read this count; refresh it after a read.
  const refreshUnread = () => void queryClient.invalidateQueries({ queryKey: ['buyer', 'unread-counts'] })

  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchNotifications({ limit: 50, offset: 0, audience: 'BUYER', view: 'unread' })
        setItems(res.items || [])
        setError('')
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
        setRefreshing(false)
      }
    },
    [t]
  )

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load(true)
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead('BUYER')
      refreshUnread()
      setItems([])
      void dismissDelivered('all')
    } catch {
      // ignore
    } finally {
      setMarkingAll(false)
    }
  }

  const handleItemPress = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
        refreshUnread()
      } catch {
        // ignore
      }
    }
    // Only unread notifications are listed: once read, it leaves the list.
    setItems((prev) => prev.filter((n) => n.id !== item.id))
    void dismissDelivered([item.id])

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
      const d = new Date(val)
      return d.toLocaleDateString(dateLocale(lang), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length

  // Aujourd'hui / Cette semaine / Plus tôt, from each notification's own timestamp.
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
      const at = new Date(n.created_at).getTime()
      groups[at >= startOfToday.getTime() ? 0 : at >= weekAgo ? 1 : 2].items.push(n)
    }
    return groups.flatMap((g) => g.items.length ? [{ kind: 'header' as const, key: `h-${g.key}`, label: g.label }, ...g.items.map((item) => ({ kind: 'item' as const, key: item.id, item }))] : [])
  }, [items, t])

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'header') return <Text style={styles.groupLabel}>{row.label}</Text>
    const item = row.item
    const iconName = getNotificationIcon(item.type)
    return (
      <TouchableOpacity
        style={[styles.itemCard, !item.is_read && styles.itemCardUnread]}
        onPress={() => void handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, !item.is_read ? styles.iconContainerUnread : styles.iconContainerRead]}>
          <Ionicons name={iconName} size={19} color={!item.is_read ? colors.green : colors.muted} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.bodyText} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.dateText}>{formatDateTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.pageTitle}>{t('notifications.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('notifSettings.title')}
            onPress={() => router.push({ pathname: '/notification-settings', params: { space: 'buyer' } })}
            hitSlop={10}
          >
            <Ionicons name="settings-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => void handleMarkAll()} disabled={markingAll} style={styles.markAllBtn}>
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.green} />
            ) : (
              <Text style={styles.markAllText}>{t('notifications.markAll')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !items.length ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{t('notifications.empty')}</Text>
          <Text style={styles.emptyDesc}>{t('communication.noNotificationsDesc')}</Text>
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.cream,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      backgroundColor: colors.cream,
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pageTitle: {
      fontSize: 21,
      fontFamily: fonts.display,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: colors.ink,
    },
    counterBadge: {
      backgroundColor: colors.green,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    counterText: {
      color: colors.onGreen,
      fontSize: 11,
      fontWeight: '800',
    },
    markAllBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    markAllText: {
      color: colors.green,
      fontSize: 12.5,
      fontWeight: '700',
    },
    groupLabel: {
      ...kicker,
      color: colors.muted,
      marginTop: 8,
      marginBottom: -2,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      gap: 10,
    },
    itemCard: {
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderRadius: radius.md,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      alignItems: 'flex-start',
      ...shadow.card,
    },
    itemCardUnread: {
      backgroundColor: colors.white,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainerUnread: {
      backgroundColor: colors.greenSoft,
    },
    iconContainerRead: {
      backgroundColor: colors.surface2,
    },
    contentContainer: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    title: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.ink,
      flex: 1,
    },
    titleUnread: {
      fontWeight: '700',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.green,
      marginLeft: 8,
    },
    bodyText: {
      fontSize: 12.5,
      color: colors.muted,
      lineHeight: 17,
      marginTop: 1,
    },
    dateText: {
      fontSize: 11,
      color: colors.faint,
      marginTop: 6,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: 8,
    },
    loadingText: {
      fontSize: 13,
      color: colors.muted,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.ink,
      marginTop: 6,
    },
    emptyDesc: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      maxWidth: 260,
    },
    errorBox: {
      backgroundColor: colors.dangerSoft,
      padding: 10,
      margin: spacing.md,
      borderRadius: radius.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      textAlign: 'center',
    },
  })

/** Large screens: the account column on the left (AccountShell). */
export default function NotificationsScreenRoute() {
  return <AccountShell><NotificationsScreen /></AccountShell>
}
