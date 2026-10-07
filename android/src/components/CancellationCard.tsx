import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useColors } from '../store/theme'
import { useI18n, type TranslationKey } from '../store/i18n'
import { dateLocale } from '../lib/format'
import { radius, type Colors } from '../theme'
import type { OrderCancellation } from '../types'

/**
 * Who cancelled (or refused) the order, when, at which stage and why. Shown to
 * the buyer, the seller and TBK on a cancelled or refused order.
 */
export function CancellationCard({ cancellation, rejected = false }: { cancellation?: OrderCancellation | null; rejected?: boolean }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t, lang } = useI18n()
  if (!cancellation) return null
  const who = rejected && cancellation.cancelled_by_role === 'SELLER'
    ? t('cancellation.rejectedBySeller')
    : t(`cancellation.by.${cancellation.cancelled_by_role}` as TranslationKey)
  const when = new Date(cancellation.cancelled_at).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const stage = cancellation.stage ? t(`cancellation.stage.${cancellation.stage}` as TranslationKey) : ''
  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}><Ionicons name="close-circle" size={20} color={c.danger} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{t(rejected ? 'cancellation.titleRejected' : 'cancellation.title')}</Text>
          <Text style={s.who}>{who}{cancellation.cancelled_by_name ? ` · ${cancellation.cancelled_by_name}` : ''}</Text>
        </View>
      </View>
      <Text style={s.meta}>{when}{stage ? ` · ${stage}` : ''}</Text>
      <View style={s.reasonBox}>
        <Text style={s.reasonLabel}>{t('cancellation.reason')}</Text>
        <Text style={s.reason}>{cancellation.reason || t('cancellation.noReason')}</Text>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.ink, fontSize: 16, fontWeight: '800' },
  who: { color: c.danger, fontSize: 14, fontWeight: '700' },
  meta: { color: c.muted, fontSize: 13 },
  reasonBox: { backgroundColor: c.surface2, borderRadius: radius.sm, padding: 12, gap: 4 },
  reasonLabel: { color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  reason: { color: c.ink, fontSize: 15, lineHeight: 21 },
})
