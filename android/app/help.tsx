import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useAuth } from '../src/store/auth'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../src/api'
import { sendOrderMessage } from '../src/api/communication'
import { Accordion, DescriptionText } from '../src/components/Accordion'
import { Button } from '../src/components/ui'
import { statusLabel } from '../src/lib/statusLabels'
import { useI18n, type TranslationKey } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../src/theme'

const FAQ: Array<{ id: string; q: TranslationKey; a: TranslationKey }> = [
  { id: 'delivery', q: 'help.faqDeliveryQ', a: 'help.faqDeliveryA' },
  { id: 'mobile-money', q: 'help.faqMobileMoneyQ', a: 'help.faqMobileMoneyA' },
  { id: 'return', q: 'help.faqReturnQ', a: 'help.faqReturnA' },
]

const ISSUES: TranslationKey[] = ['help.issueNotReceived', 'help.issueWrongItem', 'help.issueDamaged', 'help.issueRefund']

/**
 * Aide & réclamations (reference 18). There is no dedicated complaint API: a
 * report goes to TBK support through the order's existing private channel
 * (buyer -> ADMIN), so the answer arrives in that order's conversation.
 */
export default function HelpScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [issue, setIssue] = useState<TranslationKey | null>(null)
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)

  // A complaint goes to TBK through one of the buyer's orders, so it needs an account.
  const signedIn = useAuth((state) => Boolean(state.user))
  const orders = useQuery({ queryKey: ['buyer', 'orders', 'help'], queryFn: buyerApi.orders, enabled: signedIn })
  const recent = useMemo(() => (Array.isArray(orders.data) ? [...orders.data] : [])
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10), [orders.data])

  const report = useMutation({
    mutationFn: () => sendOrderMessage(orderId!, [issue ? t(issue) : '', details.trim()].filter(Boolean).join(' — '), 'ADMIN', 'BUYER'),
    onSuccess: () => { setSent(true); setDetails(''); setIssue(null) },
  })

  const q = search.trim().toLowerCase()
  const faq = FAQ.filter((f) => !q || t(f.q).toLowerCase().includes(q) || t(f.a).toLowerCase().includes(q))
  const canSend = Boolean(orderId) && Boolean(issue || details.trim()) && !report.isPending

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>{t('help.title')}</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('help.searchPlaceholder')}
          placeholderTextColor={colors.faint}
          accessibilityLabel={t('help.searchPlaceholder')}
        />
      </View>

      <View style={styles.card}>
        {faq.length
          ? <Accordion items={faq.map((f) => ({ id: f.id, title: t(f.q), content: <DescriptionText text={t(f.a)} /> }))} />
          : <Text style={styles.muted}>{t('help.noFaqMatch')}</Text>}
      </View>

      <View style={[styles.card, { gap: 12 }]}>
        <Text style={styles.cardTitle}>{t('help.reportTitle')}</Text>

        <Text style={styles.label}>{t('help.reportOrder')}</Text>
        {!signedIn ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.muted}>{t('profile.signInPrompt')}</Text>
            <Button title={t('common.signIn')} onPress={() => router.push('/auth/login')} />
          </View>
        ) : orders.isError ? <Text style={styles.error}>{orders.error instanceof Error ? orders.error.message : t('common.error')}</Text>
          : orders.isLoading ? <Text style={styles.muted}>{t('common.loading')}</Text>
          : recent.length === 0 ? <Text style={styles.muted}>{t('help.reportNoOrders')}</Text>
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recent.map((o) => {
                const on = o.id === orderId
                return (
                  <Pressable key={o.id} onPress={() => { setOrderId(o.id); setSent(false) }} style={[styles.orderChip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Text style={[styles.orderNum, on && styles.chipTextOn]}>{o.order_number || o.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.orderStatus} numberOfLines={1}>{statusLabel(t, o.status)}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>}

        <View style={styles.chips}>
          {ISSUES.map((key) => {
            const on = issue === key
            return (
              <Pressable key={key} onPress={() => { setIssue(on ? null : key); setSent(false) }} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(key)}</Text>
              </Pressable>
            )
          })}
        </View>

        <TextInput
          style={styles.textarea}
          value={details}
          onChangeText={(v) => { setDetails(v); setSent(false) }}
          placeholder={t('help.reportPlaceholder')}
          placeholderTextColor={colors.faint}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          accessibilityLabel={t('help.reportPlaceholder')}
        />

        {report.isError ? <Text style={styles.error}>{report.error instanceof Error && report.error.message ? report.error.message : t('help.reportFailed')}</Text> : null}
        {sent ? <View style={styles.success}><Ionicons name="checkmark-circle" size={18} color={colors.success} /><Text style={styles.successText}>{t('help.reportSent')}</Text></View> : null}

        <Button title={t('help.reportSubmit')} loading={report.isPending} disabled={!canSend} onPress={() => report.mutate()} />
      </View>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  h1: { fontFamily: fonts.display, fontWeight: '700', fontSize: 21, letterSpacing: -0.3, color: c.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.white, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 14, color: c.ink, paddingVertical: 10 },
  card: { backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: spacing.md, ...shadow.card },
  cardTitle: { fontFamily: fonts.display, fontWeight: '700', fontSize: 16, color: c.ink },
  label: { ...kicker, color: c.muted },
  muted: { color: c.muted, fontSize: 13 },
  error: { color: c.danger, fontSize: 13 },
  orderChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, minWidth: 120 },
  orderNum: { color: c.ink, fontWeight: '700', fontSize: 13 },
  orderStatus: { color: c.muted, fontSize: 11.5, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  chipOn: { borderColor: c.green, borderWidth: 1.5, backgroundColor: c.greenSoft },
  chipText: { color: c.ink, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: c.green, fontWeight: '700' },
  textarea: { minHeight: 110, borderRadius: radius.sm, backgroundColor: c.surface2, padding: 12, fontSize: 14, color: c.ink },
  success: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.successSoft, borderRadius: radius.sm, padding: 10 },
  successText: { flex: 1, color: c.success, fontSize: 13, fontWeight: '600' },
})
