import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
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
  type ChatParty,
  type OrderConversationDetail,
  type OrderMessage,
} from '../api/communication'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

interface OrderChatFeedProps {
  orderId: string
  role?: ChatParty
  onClose?: () => void
  showHeader?: boolean
}

const PARTY_LABEL: Record<ChatParty, string> = {
  BUYER: 'Acheteur',
  SELLER: 'Vendeur',
  COURIER: 'Livreur',
  ADMIN: 'Support TBK',
}

/** Party name inside a French sentence: "le support TBK", "livreur"… */
function partyInSentence(party: ChatParty): string {
  return party === 'ADMIN' ? 'le support TBK' : PARTY_LABEL[party].toLowerCase()
}

/**
 * Private order channels: one chip per contact, each a two-party thread the
 * server returns only to those two parties. Buyer and seller never share one.
 */
export function OrderChatFeed({
  orderId,
  role = 'BUYER',
  onClose,
  showHeader = true,
}: OrderChatFeedProps) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = makeStyles(colors)

  const [data, setData] = useState<OrderConversationDetail | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [contact, setContact] = useState<ChatParty | ''>('')

  const flatListRef = useRef<FlatList>(null)
  // Android is edge-to-edge (Expo 57): the window no longer resizes for the
  // keyboard and KeyboardAvoidingView's maths are off by the header and status
  // bar. Lift the composer by exactly the part of the feed the keyboard covers.
  const containerRef = useRef<View>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      // measureInWindow is relative to the area below the status bar while the
      // keyboard's screenY is in full-screen coordinates.
      containerRef.current?.measureInWindow((_x, y, _w, h) => {
        const bottomOnScreen = y + h + (StatusBar.currentHeight ?? 0)
        setKeyboardInset(Math.max(0, bottomOnScreen - e.endCoordinates.screenY))
      })
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  const loadConversation = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchOrderConversation(orderId, role)
        setData(res)
        setMessages(res.messages || [])
        setError('')
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [orderId, role, t]
  )

  useEffect(() => {
    void loadConversation()
    const timer = setInterval(() => void loadConversation(true), 4000)
    return () => clearInterval(timer)
  }, [loadConversation])

  const contacts = data?.contacts ?? []
  useEffect(() => {
    if (!contact && contacts.length > 0) {
      const withUnread = contacts.find((c) => c.unread > 0 && c.available)
      setContact((withUnread ?? contacts.find((c) => c.available) ?? contacts[0]).party)
    }
  }, [contacts, contact])
  const me = data?.my_party ?? role
  const selected = contacts.find((c) => c.party === contact)
  const thread = useMemo(
    () => messages.filter((m) =>
      contact !== '' &&
      ((m.sender_party === me && m.recipient_party === contact) ||
        (m.sender_party === contact && m.recipient_party === me))
    ),
    [messages, contact, me]
  )

  const handleSend = async () => {
    const text = body.trim()
    if (!text || sending || !contact || !selected?.available) return

    setSending(true)
    setError('')
    try {
      const msg = await sendOrderMessage(orderId, text, contact, role)
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
    const isMe = item.sender_party === me
    const isAdmin = item.sender_party === 'ADMIN'

    if (isAdmin) {
      return (
        <View style={styles.adminMessageContainer}>
          <View style={styles.adminBadgeRow}>
            <Ionicons name="shield-checkmark" size={14} color="#D97706" />
            <Text style={styles.adminBadgeText}>{t('communication.adminIntervention')}</Text>
          </View>
          <Text style={styles.adminMessageBody}>{item.body}</Text>
          <Text style={styles.adminMessageTime}>
            {item.sender_name || t('communication.adminName')} • {formatTime(item.created_at)}
          </Text>
        </View>
      )
    }

    return (
      <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && (
            <Text style={styles.senderName}>
              {item.sender_name || PARTY_LABEL[item.sender_party]}
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
    <View ref={containerRef} style={[styles.container, { paddingBottom: keyboardInset }]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {showHeader && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {t('communication.channelTitle')} #{data?.order_number || orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.headerSubtitle}>{data?.shop_name || ''}</Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chipsRow}>
        {contacts.map((c) => {
          const active = c.party === contact
          return (
            <TouchableOpacity
              key={c.party}
              onPress={() => setContact(c.party)}
              style={[styles.chip, active && styles.chipActive, !c.available && { opacity: 0.55 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {PARTY_LABEL[c.party]}{c.unread > 0 ? ` (${c.unread})` : ''}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {selected ? (
        <Text style={styles.privacyNote}>
          Conversation privée avec {partyInSentence(selected.party)}{selected.name && selected.name.toLowerCase() !== PARTY_LABEL[selected.party].toLowerCase() ? ` (${selected.name})` : ''} : personne d’autre ne la voit.
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !thread.length ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : thread.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="chatbubbles-outline" size={44} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{t('communication.emptyChatTitle')}</Text>
          <Text style={styles.emptyDesc}>
            {selected && !selected.available ? 'Aucun livreur n’est encore assigné à cette commande.' : t('communication.emptyChatDesc')}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={thread}
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
          placeholder={selected ? `Message privé ${selected.party === 'ADMIN' ? 'au support TBK' : `à ${partyInSentence(selected.party)}`}…` : t('communication.inputPlaceholder')}
          editable={!!selected?.available}
          placeholderTextColor={colors.mutedLight}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!body.trim() || sending || !selected?.available) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!body.trim() || sending || !selected?.available}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
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
    chipsBar: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chipsRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    chipActive: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.ink,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    privacyNote: {
      fontSize: 11,
      color: colors.muted,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
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
