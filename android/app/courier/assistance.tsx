import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { Accordion } from '../../src/components/Accordion'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'
import { CourierHeader, FINISHED_STATUSES, IconDisc, missionPhase, openMission } from '../../src/components/CourierUI'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'

const FAQ = [1, 2, 3, 4, 5] as const

/**
 * Courier help (reference "Écran Assistance"). No support phone number exists
 * in the app's data, so there is no call row. Chat and problem reports act on
 * the mission in progress, through the order chat and the mission page.
 */
export default function CourierAssistanceScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const [chatOrder, setChatOrder] = useState<string | null>(null)
  const [faqOpen, setFaqOpen] = useState(false)
  const missions = useQuery({ queryKey: ['courier', 'missions'], queryFn: courierApi.missions })
  const active = (missions.data ?? []).filter((m) => !FINISHED_STATUSES.includes(m.delivery_status))
  // The mission most likely concerned: one on the road first, then one to collect.
  const current = active.find((m) => missionPhase(m.delivery_status) === 'ongoing') ?? active.find((m) => missionPhase(m.delivery_status) !== 'new') ?? active[0]

  if (chatOrder) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <OrderChatFeed orderId={chatOrder} role="COURIER" initialParty="ADMIN" onClose={() => setChatOrder(null)} />
      </View>
    )
  }

  const forOrder = current ? t('courierUi.card.order', { number: current.order_number }) : ''

  return (
    <View style={styles.screen}>
      <CourierHeader back title={t('courierUi.assistance.title')} />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.card, styles.helpCard]}>
          <IconDisc name="headset" size={52} colors={colors} />
          <View style={styles.shrink}>
            <Text style={styles.helpTitle}>{t('courierUi.assistance.needHelp')}</Text>
            <Text style={styles.sub}>{t('courierUi.assistance.needHelpBody')}</Text>
          </View>
        </View>

        <Row
          icon="chatbubble-ellipses-outline"
          title={t('courierUi.assistance.chat')}
          subtitle={current ? `${t('courierUi.assistance.chatBody')} · ${forOrder}` : t('courierUi.assistance.noMission')}
          disabled={!current}
          onPress={() => current && setChatOrder(current.order_id)}
        />

        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: faqOpen }} onPress={() => setFaqOpen((v) => !v)} style={styles.row}>
            <IconDisc name="help" size={40} colors={colors} />
            <View style={styles.shrink}>
              <Text style={styles.rowTitle}>{t('courierUi.assistance.faq')}</Text>
              <Text style={styles.sub}>{t('courierUi.assistance.faqBody')}</Text>
            </View>
            <Ionicons name={faqOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedLight} />
          </Pressable>
          {faqOpen ? (
            <Accordion
              items={FAQ.map((n) => ({
                id: `q${n}`,
                title: t(`courierUi.faq.q${n}` as TranslationKey),
                content: <Text style={styles.answer}>{t(`courierUi.faq.a${n}` as TranslationKey)}</Text>,
              }))}
            />
          ) : null}
        </View>

        <Row
          icon="warning-outline"
          danger
          title={t('courierUi.assistance.report')}
          subtitle={current ? `${t('courierUi.assistance.reportBody')} · ${forOrder}` : t('courierUi.assistance.reportNone')}
          // Failure and "client introuvable" are recorded on the mission page.
          onPress={() => (current ? openMission(current.order_id) : router.navigate('/courier/deliveries'))}
        />
      </ScrollView>
    </View>
  )
}

function Row({ icon, title, subtitle, onPress, disabled, danger }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.card, styles.row, disabled && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}>
      <IconDisc name={icon} size={40} colors={colors} tone={danger ? 'danger' : 'blue'} />
      <View style={styles.shrink}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.sub} numberOfLines={2}>{subtitle}</Text>
      </View>
      {!disabled ? <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} /> : null}
    </Pressable>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  page: { padding: spacing.md, gap: spacing.sm + 2, paddingBottom: spacing.xl },
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  helpCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.greenSoft, borderColor: c.greenSoft },
  helpTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  rowTitle: { color: c.ink, fontWeight: '800', fontSize: 15 },
  sub: { color: c.muted, fontSize: 13 },
  answer: { color: c.muted, fontSize: 14, lineHeight: 20 },
  shrink: { flex: 1, minWidth: 0 },
})
