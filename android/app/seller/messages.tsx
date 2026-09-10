import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  fetchSellerConversations,
  type ConversationListItem,
} from '../../src/api/communication'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

export default function SellerMessagesScreen() {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const activeShop = useAuth((s) => s.activeShop)
  const activeBusiness = useAuth((s) => s.activeBusiness)

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchSellerConversations({
          shop_id: activeShop || undefined,
          business_id: activeBusiness?.id || undefined,
          limit: 50,
          offset: 0,
        })
        setConversations(res.items || [])
        setError('')
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
        setRefreshing(false)
      }
    },
    [activeShop, activeBusiness?.id, t]
  )

  useEffect(() => {
    void loadConversations()
    const timer = setInterval(() => void loadConversations(true), 10_000)
    return () => clearInterval(timer)
  }, [loadConversations])

  const onRefresh = () => {
    setRefreshing(true)
    void loadConversations(true)
  }

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.order_number.toLowerCase().includes(q) ||
      c.buyer_name.toLowerCase().includes(q) ||
      c.last_message.toLowerCase().includes(q) ||
      c.shop_name.toLowerCase().includes(q)
    )
  })

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

  if (selectedOrderId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        <OrderChatFeed
          orderId={selectedOrderId}
          role="SELLER"
          onClose={() => setSelectedOrderId(null)}
          showHeader={true}
        />
      </View>
    )
  }

  const renderItem = ({ item }: { item: ConversationListItem }) => {
    const isUnread = item.unread_count > 0
    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => setSelectedOrderId(item.order_id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.buyerRow}>
            <Ionicons name="person-circle-outline" size={22} color={colors.green} />
            <Text style={styles.buyerName} numberOfLines={1}>
              {item.buyer_name || t('communication.buyer')}
            </Text>
          </View>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
        </View>

        <Text style={[styles.lastMessage, isUnread && styles.lastMessageUnread]} numberOfLines={2}>
          {item.last_message || t('communication.noMessagesYet')}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>{formatDateTime(item.last_message_at || item.created_at)}</Text>
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCountText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={18} color={colors.mutedLight} style={{ marginLeft: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('common.search')}
          placeholderTextColor={colors.mutedLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={16} color={colors.mutedLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !conversations.length ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{t('communication.noConversations')}</Text>
          <Text style={styles.emptyDesc}>{t('communication.sellerSubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.conversation_id}
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
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xs,
    },
    searchInput: {
      flex: 1,
      height: 40,
      paddingHorizontal: spacing.sm,
      fontSize: 14,
      color: colors.ink,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    cardUnread: {
      borderColor: colors.green,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    buyerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    buyerName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.ink,
      flex: 1,
    },
    orderNumber: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.green,
    },
    lastMessage: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    lastMessageUnread: {
      color: colors.ink,
      fontWeight: '700',
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    timeText: {
      fontSize: 11,
      color: colors.mutedLight,
    },
    unreadBadge: {
      backgroundColor: colors.green,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    unreadCountText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
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
      maxWidth: 280,
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
