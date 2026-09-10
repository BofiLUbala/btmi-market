import { useEffect, useState, useCallback, useMemo } from 'react'
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
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../src/api/communication'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { radius, spacing, type Colors } from '../src/theme'

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

export default function NotificationsScreen() {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchNotifications({ limit: 50, offset: 0 })
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
      await markAllNotificationsRead()
      await load(true)
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
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        )
      } catch {
        // ignore
      }
    }

    if (item.type === 'NEW_MESSAGE' && item.metadata?.order_id) {
      router.push(`/orders/${item.metadata.order_id}` as any)
    } else if (item.reference_type === 'ORDER' && item.reference_id) {
      router.push(`/orders/${item.reference_id}` as any)
    }
  }

  const formatDateTime = (val: string) => {
    try {
      const d = new Date(val)
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const iconName = getNotificationIcon(item.type)
    return (
      <TouchableOpacity
        style={[styles.itemCard, !item.is_read && styles.itemCardUnread]}
        onPress={() => void handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, !item.is_read ? styles.iconContainerUnread : styles.iconContainerRead]}>
          <Ionicons name={iconName} size={20} color={!item.is_read ? '#FFFFFF' : colors.muted} />
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
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
      paddingVertical: spacing.sm,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pageTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.ink,
    },
    counterBadge: {
      backgroundColor: colors.green,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    counterText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    markAllBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    markAllText: {
      color: colors.green,
      fontSize: 13,
      fontWeight: '700',
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    itemCard: {
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    itemCardUnread: {
      borderColor: colors.green,
      backgroundColor: colors.white,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainerUnread: {
      backgroundColor: colors.green,
    },
    iconContainerRead: {
      backgroundColor: colors.surfaceAlt,
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
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
      flex: 1,
    },
    titleUnread: {
      fontWeight: '900',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.green,
      marginLeft: 6,
    },
    bodyText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginTop: 2,
    },
    dateText: {
      fontSize: 11,
      color: colors.mutedLight,
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
      backgroundColor: '#FEE2E2',
      padding: 10,
      margin: spacing.md,
      borderRadius: radius.sm,
    },
    errorText: {
      color: '#DC2626',
      fontSize: 13,
      textAlign: 'center',
    },
  })
