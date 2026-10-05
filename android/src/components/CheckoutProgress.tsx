import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import type { Colors } from '../theme'
import type { TranslationKey } from '../locales/fr'

const STEPS: Array<{ id: 'cart' | 'delivery' | 'payment' | 'order'; label: TranslationKey }> = [
  { id: 'cart', label: 'checkout.step.cart' },
  { id: 'delivery', label: 'checkout.step.delivery' },
  { id: 'payment', label: 'checkout.step.review' },
  { id: 'order', label: 'checkout.step.order' },
]

/** Thin segmented bar (blue = done/current, grey = to do) with the step
 *  names underneath — the reference's checkout progress. */
export function CheckoutProgress({ current }: { current: (typeof STEPS)[number]['id'] }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const active = STEPS.findIndex((step) => step.id === current)
  return (
    <View style={s.row} accessibilityRole="progressbar" accessibilityLabel={t('checkout.progress')}>
      {STEPS.map((step, index) => {
        const done = index < active
        const on = index <= active
        return (
          <View key={step.id} style={s.step}>
            <View style={[s.segment, on && s.segmentOn]} />
            <View style={s.labelRow}>
              {done ? <Ionicons name="checkmark-circle" size={12} color={c.green} /> : null}
              <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{t(step.label)}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 6, marginBottom: 2 },
    step: { flex: 1, gap: 7 },
    segment: { height: 4, borderRadius: 2, backgroundColor: c.border },
    segmentOn: { backgroundColor: c.green },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    label: { color: c.muted, fontSize: 11, fontWeight: '600', flexShrink: 1 },
    labelOn: { color: c.ink, fontWeight: '700' },
  })
