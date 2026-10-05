import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { resolveMediaUrl } from '../api/client'
import { formatMoney } from '../lib/money'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  fetchOrderConversation,
  markChannelRead,
  sendOrderMessage,
  type ChatParty,
  type OrderConversationDetail,
  type OrderMessage,
} from '../api/communication'
import { canWriteTo, dayKey, initialContact, startsRun, threadWith } from '../lib/chat'
import { subscribeOrderEvents } from '../lib/orderEvents'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { dateLocale } from '../lib/format'
import { radius, shadow, spacing, type Colors } from '../theme'

interface OrderChatFeedProps {
  orderId: string
  role?: ChatParty
  onClose?: () => void
  showHeader?: boolean
  /** Channel to open first (e.g. the courier from the order's courier card). */
  initialParty?: ChatParty
  /** The order's first item, shown as the conversation's context card. */
  product?: { name?: string; imageUrl?: string | null; price?: number; productId?: string }
}

/** A message typed here and not yet confirmed by the server. */
interface Pending { key: string; body: string; to: ChatParty; failed: boolean; at: string }

/** One row of the list: a day separator or a message (sent or pending). */
type Row =
  | { kind: 'day'; key: string; day: string }
  | { kind: 'msg'; key: string; msg: OrderMessage; run: boolean }
  | { kind: 'pending'; key: string; p: Pending }

const POLL_MS = 15_000
const partyKey = (p: ChatParty) => `chat.party.${p}` as TranslationKey

/**
 * Private order channels, one tab per two-party thread (buyer <-> seller is
 * never one). Fetching never marks anything read: only the thread on screen,
 * while the app is in the foreground.
 */
export function OrderChatFeed({ orderId, role = 'BUYER', onClose, showHeader = true, initialParty, product }: OrderChatFeedProps) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [detail, setDetail] = useState<OrderConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [draft, setDraft] = useState('')
  const [contact, setContact] = useState<ChatParty | ''>('')
  const [pending, setPending] = useState<Pending[]>([])
  const [active, setActive] = useState(AppState.currentState === 'active')
  const listRef = useRef<FlatList<Row>>(null)
  // Edge-to-edge: keep the composer above the gesture bar (the keyboard covers it when open).
  const insets = useSafeAreaInsets()

  // Android is edge-to-edge (Expo 57): the window no longer resizes for the
  // keyboard. Lift the composer by exactly the part of the feed it covers.
  const containerRef = useRef<View>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      containerRef.current?.measureInWindow((_x, y, _w, h) => {
        const bottomOnScreen = y + h + (StatusBar.currentHeight ?? 0)
        setKeyboardInset(Math.max(0, bottomOnScreen - e.endCoordinates.screenY))
      })
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'))
    return () => sub.remove()
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchOrderConversation(orderId, role)
      setDetail({ ...res, messages: res.messages || [], contacts: res.contacts || [] })
      setLoadError('')
    } catch (err) {
      if (!silent) setLoadError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [orderId, role, t])

  useEffect(() => { void load() }, [load])
  // New messages arrive with the order's events; polling in the foreground is the fallback.
  useEffect(() => subscribeOrderEvents('user', (event) => {
    if ((event.kind === 'order' && event.order_id === orderId) || event.kind === 'resync') void load(true)
  }), [orderId, load])
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => void load(true), POLL_MS)
    return () => clearInterval(timer)
  }, [active, load])

  const contacts = detail?.contacts ?? []
  useEffect(() => {
    if (!contact && contacts.length) setContact(initialParty && contacts.some((c) => c.party === initialParty) ? initialParty : initialContact(contacts))
  }, [contacts, contact, initialParty])

  const me = detail?.my_party ?? role
  const selected = contacts.find((c) => c.party === contact)
  const writable = canWriteTo(selected)
  const thread = useMemo(() => threadWith(detail?.messages ?? [], me, contact), [detail?.messages, me, contact])
  const pendingHere = pending.filter((p) => p.to === contact)

  // The open thread is read once it is on screen with the app in the foreground.
  const unreadHere = selected?.unread ?? 0
  useEffect(() => {
    if (!contact || unreadHere === 0 || !active) return
    void markChannelRead(orderId, contact, role)
      .then(() => setDetail((d) => d && { ...d, contacts: d.contacts.map((c) => (c.party === contact ? { ...c, unread: 0 } : c)) }))
      .catch(() => undefined)
  }, [contact, unreadHere, active, orderId, role])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    let lastDay = ''
    thread.forEach((m, i) => {
      const day = dayKey(m.created_at)
      if (day !== lastDay) { out.push({ kind: 'day', key: `d-${day}`, day }); lastDay = day }
      out.push({ kind: 'msg', key: m.id, msg: m, run: startsRun(thread[i - 1], m) || dayKey(thread[i - 1]?.created_at ?? '') !== day })
    })
    pendingHere.forEach((p) => out.push({ kind: 'pending', key: p.key, p }))
    return out
  }, [thread, pendingHere])

  const deliver = async (p: Pending) => {
    try {
      await sendOrderMessage(orderId, p.body, p.to, role)
      await load(true)
      setPending((list) => list.filter((x) => x.key !== p.key))
    } catch (err) {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: true } : x)))
      setSendError(err instanceof Error ? err.message : t('common.actionImpossible'))
    }
  }

  const send = () => {
    const body = draft.trim()
    if (!body || !contact || !writable) return
    const p: Pending = { key: `${Date.now()}-${Math.random()}`, body, to: contact, failed: false, at: new Date().toISOString() }
    setPending((list) => [...list, p])
    setDraft('')
    setSendError('')
    void deliver(p)
  }

  const retry = (p: Pending) => {
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: false } : x)))
    setSendError('')
    void deliver({ ...p, failed: false })
  }

  const locale = dateLocale(lang)
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const dayLabel = (day: string) => {
    const d = new Date(`${day}T12:00:00`)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return t('chat.today')
    if (d.toDateString() === new Date(today.getTime() - 86_400_000).toDateString()) return t('chat.yesterday')
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const label = (p: ChatParty) => t(partyKey(p))

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') {
      return <Text style={styles.day}>{dayLabel(item.day)}</Text>
    }
    if (item.kind === 'pending') {
      const { p } = item
      return (
        <View style={[styles.msg, styles.mine, styles.run]}>
          <View style={[styles.bubble, styles.bubbleMine, p.failed && { opacity: 0.6 }]}>
            <Text style={styles.textMine}>{p.body}</Text>
          </View>
          {p.failed ? (
            <TouchableOpacity onPress={() => retry(p)} accessibilityRole="button">
              <Text style={styles.retry}>{t('chat.notSent')}</Text>
            </TouchableOpacity>
          ) : <Text style={styles.meta}>{t('chat.sending')}</Text>}
        </View>
      )
    }
    const m = item.msg
    const mine = m.sender_party === me
    const tbk = m.sender_party === 'ADMIN' && !mine
    return (
      <View style={[styles.msg, mine ? styles.mine : styles.theirs, item.run && styles.run]}>
        {item.run && !mine ? <Text style={styles.sender}>{tbk ? `🛡️ ${label('ADMIN')}` : m.sender_name || label(m.sender_party)}</Text> : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : tbk ? styles.bubbleTbk : styles.bubbleTheirs]}>
          <Text style={mine ? styles.textMine : styles.textTheirs}>{m.body}</Text>
        </View>
        <Text style={styles.meta}>
          {time(m.created_at)}{mine ? ` · ${m.recipient_read_at ? t('chat.read') : t('chat.sent')}` : ''}
        </Text>
      </View>
    )
  }

  return (
    <View ref={containerRef} style={[styles.container, { paddingBottom: keyboardInset }]}>
      {showHeader ? (
        <View style={styles.header}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel={t('chat.back')}>
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.avatar}><Ionicons name="storefront" size={18} color={colors.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>#{detail?.order_number || orderId.slice(0, 8).toUpperCase()}</Text>
            {detail?.shop_name ? <Text style={styles.headerSub} numberOfLines={1}>{detail.shop_name}</Text> : null}
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabsRow}>
        {contacts.map((c) => {
          const on = c.party === contact
          const name = c.name && c.party !== 'ADMIN' && c.name.toLowerCase() !== label(c.party).toLowerCase() ? c.name : ''
          return (
            <TouchableOpacity
              key={c.party}
              onPress={() => { setContact(c.party); setSendError('') }}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                {label(c.party)}{name ? ` · ${name}` : ''}
              </Text>
              {c.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{c.unread}</Text></View> : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {product?.name ? (
        <View style={styles.productCard}>
          <View style={styles.productThumb}>
            {product.imageUrl ? <Image source={resolveMediaUrl(product.imageUrl)} style={styles.productImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={18} color={colors.green} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
            {typeof product.price === 'number' ? <Text style={styles.productPrice}>{formatMoney(product.price)}</Text> : null}
          </View>
          {product.productId ? (
            <TouchableOpacity onPress={() => router.push(`/products/${product.productId}`)} style={styles.productBtn} accessibilityRole="link" accessibilityLabel={t('chat.productContext')}>
              <Text style={styles.productBtnText}>{t('common.view')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {selected ? <Text style={styles.privacy}>🔒 {t('chat.privacy', { party: label(selected.party) })}</Text> : null}

      {loading && !detail ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : loadError && !detail ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('chat.loadFailed')}</Text>
          <TouchableOpacity onPress={() => void load()}><Text style={styles.retry}>{t('chat.retry')}</Text></TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>{t('chat.emptyTitle')}</Text>
          <Text style={styles.emptyDesc}>
            {selected && !selected.available && selected.party === 'COURIER' ? t('chat.courierNotAssigned') : t('chat.emptyDesc', { party: selected ? label(selected.party) : '' })}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      <View style={[styles.composer, { paddingBottom: spacing.sm + (keyboardInset > 0 ? 0 : insets.bottom) }]}>
        <TextInput
          style={styles.input}
          placeholder={selected ? t('chat.placeholder', { party: label(selected.party) }) : t('chat.pickRecipient')}
          placeholderTextColor={colors.mutedLight}
          editable={writable}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
          accessibilityLabel={t('chat.inputLabel')}
        />
        <TouchableOpacity
          style={[styles.send, (!draft.trim() || !writable) && styles.sendOff]}
          onPress={send}
          disabled={!draft.trim() || !writable}
          accessibilityLabel={t('chat.send')}
        >
          <Ionicons name="send" size={17} color={colors.onGreen} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.white },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  avatar: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.greenSoft },
  headerTitle: { fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: c.muted, marginTop: 1 },
  tabsBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.white },
  tabsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, maxWidth: 260 },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { fontSize: 12.5, fontWeight: '600', color: c.ink, flexShrink: 1 },
  tabTextOn: { color: c.onGreen },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.onGreen, fontSize: 11, fontWeight: '800' },
  privacy: { fontSize: 11, color: c.muted, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: c.cream },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: 10, borderRadius: radius.md, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, ...shadow.card },
  productThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.greenSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  productImg: { width: '100%', height: '100%' },
  productName: { color: c.ink, fontSize: 13, fontWeight: '700' },
  productPrice: { color: c.green, fontSize: 13, fontWeight: '700', marginTop: 1 },
  productBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.green },
  productBtnText: { color: c.onGreen, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 8, backgroundColor: c.cream },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
  emptyDesc: { fontSize: 13, color: c.muted, textAlign: 'center', maxWidth: 280 },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: c.cream, flexGrow: 1 },
  day: { alignSelf: 'center', marginTop: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: c.surface2, color: c.muted, fontSize: 11, fontWeight: '600' },
  msg: { marginTop: 2, maxWidth: '100%' },
  run: { marginTop: 10 },
  mine: { alignItems: 'flex-end' },
  theirs: { alignItems: 'flex-start' },
  sender: { fontSize: 11, fontWeight: '700', color: c.muted, marginHorizontal: 6, marginBottom: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  bubbleMine: { backgroundColor: c.green, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
  bubbleTbk: { backgroundColor: c.warningSoft, borderWidth: 1, borderColor: c.warning, borderBottomLeftRadius: 4 },
  textMine: { color: c.onGreen, fontSize: 14, lineHeight: 19 },
  textTheirs: { color: c.ink, fontSize: 14, lineHeight: 19 },
  meta: { fontSize: 10, color: c.faint, marginHorizontal: 6, marginTop: 3 },
  retry: { fontSize: 12, fontWeight: '800', color: c.danger, marginHorizontal: 6, marginTop: 2 },
  error: { fontSize: 12, color: c.danger, paddingHorizontal: spacing.md, paddingVertical: 4, backgroundColor: c.white },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.white },
  input: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, color: c.ink },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  sendOff: { opacity: 0.45 },
})
