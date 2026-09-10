import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  fetchOrderConversation,
  sendOrderMessage,
  type OrderConversationDetail,
  type OrderMessage,
} from '../api/communication'
import { useAuth } from '../store/auth'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

interface OrderChatFeedProps {
  orderId: string
  role?: 'BUYER' | 'SELLER' | 'ADMIN'
  onClose?: () => void
  showHeader?: boolean
}

export function OrderChatFeed({
  orderId,
  role = 'BUYER',
  onClose,
  showHeader = true,
}: OrderChatFeedProps) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const currentUser = useAuth((s) => s.user)
  const styles = makeStyles(colors)

  const [data, setData] = useState<OrderConversationDetail | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')

  const flatListRef = useRef<FlatList>(null)

  const loadConversation = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchOrderConversation(orderId)
        setData(res)
        setMessages(res.messages || [])
        setError('')
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [orderId, t]
  )

  useEffect(() => {
    void loadConversation()
    const timer = setInterval(() => void loadConversation(true), 4000)
    return () => clearInterval(timer)
  }, [loadConversation])

  const handleSend = async () => {
    const text = body.trim()
    if (!text || sending) return

    setSending(true)
    setError('')
    try {
      const msg = await sendOrderMessage(orderId, text)
      setMessages((prev) => [...prev, msg])
      setBody('')
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionImpossible'))
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const renderMessage = ({ item }: { item: OrderMessage }) => {
    const isMe = item.sender_user_id === currentUser?.id
    const isAdmin = item.is_admin_intervention || item.sender_type === 'COMMERCE_ADMIN' || item.sender_type === 'SUPER_ADMIN'

    if (isAdmin) {
      return (
        <View style={styles.adminMessageContainer}>
          <View style={styles.adminBadgeRow}>
            <Ionicons name="shield-checkmark" size={14} color="#D97706" />
            <Text style={styles.adminBadgeText}>Intervention Officielle TBK Admin</Text>
          </View>
          <Text style={styles.adminMessageBody}>{item.body}</Text>
          <Text style={styles.adminMessageTime}>
            {item.sender_name || 'Admin TBK'} • {formatTime(item.created_at)}
          </Text>
        </View>
      )
    }

    return (
      <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && (
            <Text style={styles.senderName}>
              {item.sender_name || (item.sender_type === 'SELLER' ? t('communication.seller') : t('communication.buyer'))}
            </Text>
          )}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item.body}
          </Text>
          <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {showHeader && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              💬 {t('communication.channelTitle')} #{data?.order_number || orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.headerSubtitle}>
              {role === 'BUYER' ? data?.shop_name || t('communication.seller') : data?.buyer_name || t('communication.buyer')}
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !messages.length ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="chatbubbles-outline" size={44} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{t('communication.emptyChatTitle')}</Text>
          <Text style={styles.emptyDesc}>{t('communication.emptyChatDesc')}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('communication.inputPlaceholder')}
          placeholderTextColor={colors.mutedLight}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!body.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!body.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.white,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.white,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.ink,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    closeBtn: {
      padding: spacing.xs,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: 8,
    },
    loadingText: {
      fontSize: 13,
      color: colors.muted,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      marginTop: 6,
    },
    emptyDesc: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      maxWidth: 260,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    bubbleWrapper: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    myBubbleWrapper: {
      justifyContent: 'flex-end',
    },
    otherBubbleWrapper: {
      justifyContent: 'flex-start',
    },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    myBubble: {
      backgroundColor: colors.green,
      borderBottomRightRadius: 2,
    },
    otherBubble: {
      backgroundColor: colors.surfaceAlt,
      borderBottomLeftRadius: 2,
    },
    senderName: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 3,
    },
    messageText: {
      fontSize: 14,
      lineHeight: 20,
    },
    myMessageText: {
      color: '#FFFFFF',
    },
    otherMessageText: {
      color: colors.ink,
    },
    timeText: {
      fontSize: 10,
      marginTop: 4,
      alignSelf: 'flex-end',
    },
    myTimeText: {
      color: 'rgba(255,255,255,0.7)',
    },
    otherTimeText: {
      color: colors.muted,
    },
    adminMessageContainer: {
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: 12,
      marginVertical: 6,
    },
    adminBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    adminBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#B45309',
    },
    adminMessageBody: {
      fontSize: 14,
      lineHeight: 20,
      color: '#78350F',
    },
    adminMessageTime: {
      fontSize: 10,
      color: '#92400E',
      marginTop: 6,
      alignSelf: 'flex-end',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.ink,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    errorBanner: {
      backgroundColor: '#FEE2E2',
      padding: 8,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      borderRadius: radius.sm,
    },
    errorText: {
      fontSize: 12,
      color: '#DC2626',
      textAlign: 'center',
    },
  })
